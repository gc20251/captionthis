// supabase/functions/generate-captions/index.ts
//
// Server-side proxy to the Anthropic API. The browser never sees your API key —
// it sends an image here, this function calls Claude, and returns structured JSON.
//
// Deploy:  supabase functions deploy generate-captions
// Secrets: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//          supabase secrets set ALLOWED_ORIGINS="https://your-app.vercel.app,http://localhost:5173"
// DB:      supabase db push   (creates the rate_limit table — see migrations/)
//
// Runs on Deno (Supabase Edge Functions). No SDK needed — just fetch.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { normalize, OUTPUT_TOOL, validateResult } from "./contract.ts";
import {
  clientIp,
  imageTooLarge,
  isAllowedMediaType,
  isAllowedOrigin,
  parseAllowedOrigins,
  RATE_LIMIT_PER_HOUR,
} from "./security.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

// Sonnet 4.6 balances quality + cost for vision, which matters for a
// rate-limited demo. Swap to a Haiku model string for cheaper/faster runs, or
// an Opus model for higher quality, once you've tuned the prompt.
const MODEL = "claude-sonnet-4-6";

const ALLOWED_ORIGINS = parseAllowedOrigins(Deno.env.get("ALLOWED_ORIGINS"));

// Service-role client for the rate-limit table. SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY are injected into the edge runtime automatically.
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const supabase = SUPABASE_URL && SERVICE_ROLE ? createClient(SUPABASE_URL, SERVICE_ROLE) : null;

// A one-line tone description won't produce four distinguishable voices — the
// model collapses "punchy" and "minimal" into each other (RISKS.md R4). Each
// tone gets a description, exemplar captions to anchor the voice, and an
// explicit "avoid" clause to push the tones apart.
interface Tone {
  description: string;
  examples: string[];
  avoid: string;
}

const TONE_GUIDE: Record<string, Tone> = {
  punchy: {
    description: "Short, scroll-stopping, high-energy. One line, built to stop a thumb.",
    examples: ["Caught the light before it quit.", "This one hits different.", "No filter. Just timing."],
    avoid: "Avoid full sentences longer than ~8 words, hedging, and anything that reads like a diary entry.",
  },
  story: {
    description: "Warm and narrative — a caption that sets a scene and pulls the reader into a moment.",
    examples: [
      "We almost turned back at the ridge. Then the fog lifted and the whole valley just opened up.",
      "She'd been chasing a sky like this all week.",
    ],
    avoid: "Avoid ad copy and hype words ('stunning', 'breathtaking'). Keep it human and specific, one to three sentences.",
  },
  minimal: {
    description: "Spare and understated. A few words, heavy on restraint.",
    examples: ["Morning.", "Still water.", "Late light, long shadows."],
    avoid: "Avoid exclamation marks, stacked adjectives, and anything over ~5 words.",
  },
  professional: {
    description: "Polished and client-ready — the voice of a photographer's portfolio or website.",
    examples: [
      "Golden-hour portrait session along the coastal bluffs.",
      "Editorial lifestyle work for a Pacific Northwest travel brand.",
    ],
    avoid: "Avoid slang, emoji, exclamation marks, and casual first-person ('me and my...').",
  },
};

function buildPrompt(tone: string): string {
  const t = TONE_GUIDE[tone] ?? TONE_GUIDE.punchy;
  return [
    "You are a caption assistant for a working photographer.",
    "Look at the image and produce social-ready metadata.",
    "",
    `TONE — write all 3 captions in this voice: ${t.description}`,
    "Examples of this voice:",
    ...t.examples.map((e) => `  · ${e}`),
    t.avoid,
    "",
    "Requirements:",
    "- Exactly 3 distinct caption options, all in the tone above.",
    "- Alt-text: describe what a sighted person would literally see — subjects, setting, action,",
    "  notable light or color. It is an accessibility/SEO description, NOT a caption and NOT marketing.",
    "    Good: \"A woman in a red jacket stands on a rocky ridge at sunset, a valley below.\"",
    "    Bad:  \"Fearless adventurer conquers a breathtaking summit.\"",
    "- 8 to 12 hashtags, each starting with '#', specific to the subject, no duplicates, no generic filler.",
    "",
    "Call the emit_metadata tool with your answer.",
  ].join("\n");
}

// One call to Anthropic. Returns the tool_use.input, or throws with a generic
// message (details are logged server-side, never returned — R1/Day 4).
async function callAnthropic(image: string, mediaType: string, tone: string): Promise<unknown> {
  const anthropicRes = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1536,
      tools: [OUTPUT_TOOL],
      // Force the model to answer by calling our tool, so the reply is
      // structured JSON rather than prose we'd have to parse.
      tool_choice: { type: "tool", name: OUTPUT_TOOL.name },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: image },
            },
            { type: "text", text: buildPrompt(tone) },
          ],
        },
      ],
    }),
  });

  if (!anthropicRes.ok) {
    const detail = await anthropicRes.text();
    console.error("Anthropic request failed:", anthropicRes.status, detail);
    throw new Error("upstream_error");
  }

  const data = await anthropicRes.json();
  const toolBlock = (data.content ?? []).find(
    (b: { type: string; name?: string }) => b.type === "tool_use" && b.name === OUTPUT_TOOL.name,
  );
  if (!toolBlock) {
    console.error("No tool_use block in response:", JSON.stringify(data).slice(0, 500));
    throw new Error("no_tool_use");
  }
  return toolBlock.input;
}

// Atomically bump the caller's hourly counter. Returns true if still under the
// limit. Fails OPEN (allows the request) if the DB is unreachable — a database
// hiccup shouldn't take the demo down, and the Anthropic console spend limit is
// the hard money backstop regardless.
async function underRateLimit(ip: string): Promise<boolean> {
  if (!supabase) {
    console.error("Rate limiter unavailable: missing Supabase env — failing open.");
    return true;
  }
  const { data, error } = await supabase.rpc("bump_rate_limit", { client_ip: ip });
  if (error) {
    console.error("bump_rate_limit error — failing open:", error.message);
    return true;
  }
  return (data as number) <= RATE_LIMIT_PER_HOUR;
}

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = isAllowedOrigin(origin, ALLOWED_ORIGINS);
  return {
    // Echo the origin only when it's on the allowlist; otherwise "null" so the
    // browser blocks the response. Vary: Origin keeps caches honest.
    "Access-Control-Allow-Origin": allowed && origin ? origin : "null",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin);
  const respond = (body: unknown, status: number) => json(body, status, cors);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  if (req.method !== "POST") {
    return respond({ error: "Use POST." }, 405);
  }

  // Origin gate. CORS alone only constrains browsers; checking the Origin
  // header server-side also turns away scripts and curl calls from other
  // origins (or with no origin at all).
  if (!isAllowedOrigin(origin, ALLOWED_ORIGINS)) {
    return respond({ error: "Forbidden." }, 403);
  }

  if (!ANTHROPIC_API_KEY) {
    return respond({ error: "Server is missing ANTHROPIC_API_KEY." }, 500);
  }

  try {
    // Rate limit before doing any expensive work, so probing counts too.
    const ip = clientIp(req.headers);
    if (!(await underRateLimit(ip))) {
      return respond({ error: "Rate limit reached. Try again in a bit." }, 429);
    }

    const { image, mediaType, tone } = await req.json();

    if (!image || !mediaType) {
      return respond({ error: "Send an image (base64) and its mediaType." }, 400);
    }
    // Never trust the client — re-check the media type and size server-side.
    if (!isAllowedMediaType(mediaType)) {
      return respond({ error: "Unsupported image type." }, 400);
    }
    if (imageTooLarge(image)) {
      return respond({ error: "Image is too large." }, 413);
    }

    // Try up to twice: model output is not a contract until validated. If the
    // first result fails validation, retry once silently, then give up.
    let lastErrors: string[] = [];
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = normalize(await callAnthropic(image, mediaType, tone));
      lastErrors = validateResult(result);
      if (lastErrors.length === 0) {
        return respond(result, 200);
      }
      console.warn(`Validation failed (attempt ${attempt + 1}): ${lastErrors.join("; ")}`);
    }

    console.error("Giving up after retry. Last errors:", lastErrors.join("; "));
    return respond({ error: "Couldn't produce a valid result. Please try again." }, 502);
  } catch (_err) {
    // Never leak internals to the client — details are already logged above.
    return respond({ error: "Could not generate captions. Please try again." }, 500);
  }
});

function json(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });
}
