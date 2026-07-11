// supabase/functions/generate-captions/security.ts
//
// Pure, framework-agnostic guards for the edge function. Kept separate from
// index.ts so they can be unit-tested off the Deno/Supabase runtime.
//
// These are the layers that turn a public, money-spending endpoint into one
// that can be left running (RISKS.md R1): origin allowlist, media-type
// allowlist, and a hard server-side payload cap. The per-IP rate limit lives
// in index.ts because it needs the database; the Anthropic console spend limit
// is the final backstop and lives outside the code entirely.

export const ALLOWED_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// Never trust the client's downscaling. A base64 char encodes 6 bits, so
// decoded bytes ≈ chars * 3/4. 7M chars ≈ 5.25 MB decoded — comfortably above
// a legitimately downscaled JPEG (well under 1 MB) but below the point where a
// request is obviously abusive. Anthropic's own image ceiling is ~5 MB.
export const MAX_IMAGE_B64_CHARS = 7_000_000;

export const RATE_LIMIT_PER_HOUR = 10;

// Parse the ALLOWED_ORIGINS secret (comma-separated) into a clean list.
// Defaults to the Vite dev origin so local development works out of the box.
export function parseAllowedOrigins(env?: string | null): string[] {
  return (env ?? "http://localhost:5173")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// A request is only allowed if it carries an Origin header we recognise.
// Browsers always send Origin on cross-origin requests (and our app is
// cross-origin to the function), so requiring it also turns away naive scripts
// and curl calls that omit or spoof it.
export function isAllowedOrigin(origin: string | null, allowed: string[]): boolean {
  return !!origin && allowed.includes(origin);
}

export function isAllowedMediaType(mediaType: unknown): boolean {
  return typeof mediaType === "string" && ALLOWED_MEDIA_TYPES.includes(mediaType);
}

// True when the payload is missing or larger than we're willing to forward.
export function imageTooLarge(image: unknown): boolean {
  return typeof image !== "string" || image.length > MAX_IMAGE_B64_CHARS;
}

// Best-effort client IP for rate limiting. Supabase sits behind a proxy, so the
// caller's address is in x-forwarded-for (first hop) or x-real-ip.
export function clientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "unknown";
}
