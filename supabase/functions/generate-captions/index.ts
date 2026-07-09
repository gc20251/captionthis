// supabase/functions/generate-captions/index.ts
//
// Server-side proxy to the Anthropic API. The browser never sees your API key —
// it sends an image here, this function calls Claude, and returns structured JSON.
//
// Deploy:  supabase functions deploy generate-captions
// Secret:  supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//
// Runs on Deno (Supabase Edge Functions). No SDK needed — just fetch.

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

// Sonnet balances quality + cost for vision. Swap to the Haiku model string
// for cheaper, faster runs once you've tuned the prompt.
const MODEL = "claude-sonnet-4-6";

// CORS so your React app (different origin in dev) can call this.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // tighten to your domain in production
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TONE_GUIDE: Record<string, string> = {
  punchy: "short, scroll-stopping, high-energy. One line each.",
  story: "warm and narrative, like a caption that sets a scene.",
  minimal: "spare and understated. A few words, lots of restraint.",
  professional: "polished and client-ready, suitable for a portfolio or website.",
};

function buildPrompt(tone: string): string {
  const toneText = TONE_GUIDE[tone] ?? TONE_GUIDE.punchy;
  return [
    "You are a caption assistant for a working photographer.",
    "Look at the image and produce social-ready metadata.",
    "",
    `Write the captions in this tone: ${toneText}`,
    "",
    "Return ONLY a JSON object — no prose, no markdown, no code fences — with exactly this shape:",
    "{",
    '  "captions": [string, string, string],   // 3 distinct caption options',
    '  "altText": string,                       // one descriptive, SEO-friendly alt-text sentence',
    '  "hashtags": [string, ...]                // 8-12 relevant hashtags, each starting with #',
    "}",
    "",
    "Rules: alt-text describes what is literally in the frame for accessibility and SEO.",
    "Hashtags should be specific to the subject, not generic filler. No duplicates.",
  ].join("\n");
}

// Pull the JSON object out of the model's reply, tolerating stray fences/text.
function extractJson(text: string) {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON found in model response");
  return JSON.parse(cleaned.slice(start, end + 1));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Use POST." }, 405);
  }

  if (!ANTHROPIC_API_KEY) {
    return json({ error: "Server is missing ANTHROPIC_API_KEY." }, 500);
  }

  try {
    const { image, mediaType, tone } = await req.json();

    if (!image || !mediaType) {
      return json({ error: "Send an image (base64) and its mediaType." }, 400);
    }

    const anthropicRes = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
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
      return json({ error: "Anthropic request failed.", detail }, 502);
    }

    const data = await anthropicRes.json();
    const textBlock = (data.content ?? [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("\n");

    const result = extractJson(textBlock);
    return json(result, 200);
  } catch (err) {
    return json({ error: "Could not generate captions.", detail: String(err) }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}
