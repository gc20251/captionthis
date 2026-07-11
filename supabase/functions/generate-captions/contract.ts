// supabase/functions/generate-captions/contract.ts
//
// The output contract for the caption generator: the shape Claude must return,
// how we coerce its tool output into that shape, and the rules that decide
// whether a result is fit to render. Kept framework-agnostic (no Deno APIs) so
// it can be unit-tested off the edge runtime.

export interface Result {
  captions: string[];
  altText: string;
  hashtags: string[];
}

// The tool schema we force Claude to fill. Schemas enforce *structure* (types,
// required keys) but not counts or non-emptiness — validateResult covers those.
export const OUTPUT_TOOL = {
  name: "emit_metadata",
  description: "Return the social-ready metadata for the image.",
  input_schema: {
    type: "object",
    properties: {
      captions: {
        type: "array",
        items: { type: "string" },
        description: "Exactly 3 distinct caption options, written in the requested tone.",
      },
      altText: {
        type: "string",
        description:
          "One descriptive, SEO-friendly alt-text sentence describing what is literally in the frame, for accessibility.",
      },
      hashtags: {
        type: "array",
        items: { type: "string" },
        description:
          "8 to 12 relevant hashtags, each starting with '#', specific to the subject, no duplicates, no generic filler.",
      },
    },
    required: ["captions", "altText", "hashtags"],
    additionalProperties: false,
  },
};

// Coerce whatever the tool returned into our shape, trimming whitespace. Does
// not judge validity — that's validateResult's job.
export function normalize(input: unknown): Result {
  const obj = (input ?? {}) as Record<string, unknown>;
  const toStringArray = (v: unknown) =>
    Array.isArray(v) ? v.filter((x) => typeof x === "string").map((x) => (x as string).trim()) : [];
  return {
    captions: toStringArray(obj.captions),
    altText: typeof obj.altText === "string" ? obj.altText.trim() : "",
    hashtags: toStringArray(obj.hashtags),
  };
}

// The contract the model output must satisfy before we let it reach the UI.
// Returns a list of human-readable problems; empty means valid.
export function validateResult(r: Result): string[] {
  const errors: string[] = [];

  if (r.captions.length !== 3) {
    errors.push(`expected 3 captions, got ${r.captions.length}`);
  }
  if (r.captions.some((c) => c.length === 0)) {
    errors.push("a caption was empty");
  }

  if (r.altText.length === 0) {
    errors.push("altText was empty");
  }

  if (r.hashtags.length < 8 || r.hashtags.length > 12) {
    errors.push(`expected 8-12 hashtags, got ${r.hashtags.length}`);
  }
  if (r.hashtags.some((h) => !h.startsWith("#") || h.length < 2)) {
    errors.push("a hashtag was empty or missing '#'");
  }
  const seen = new Set(r.hashtags.map((h) => h.toLowerCase()));
  if (seen.size !== r.hashtags.length) {
    errors.push("hashtags contained duplicates");
  }

  return errors;
}
