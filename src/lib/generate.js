// src/lib/generate.js
//
// Prepares a File (downscale + encode) and calls the Supabase Edge Function.
// The function URL + anon key come from Vite env vars (see .env.example).

import { prepareImage } from "./image";

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-captions`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export async function generateCaptions(file, tone) {
  // Downscale to an API-safe JPEG in the browser. Throws a human-readable
  // Error for unsupported/oversized/corrupt files.
  const { data, mediaType } = await prepareImage(file);

  let res;
  try {
    res = await fetch(FUNCTION_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${ANON_KEY}`,
      },
      body: JSON.stringify({ image: data, mediaType, tone }),
    });
  } catch {
    // fetch rejects only on network-level failure (offline, DNS, blocked).
    throw new Error("Couldn't reach the server. Check your connection and try again.");
  }

  // The function returns JSON on success and on error — but an outage or proxy
  // can hand back HTML or an empty body, so don't let res.json() surface a raw
  // "Unexpected end of JSON input" to the user.
  const body = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(body?.error || "Something went wrong generating captions.");
  }
  if (!body) {
    throw new Error("Got an unexpected response from the server. Please try again.");
  }
  return body; // { captions: [...], altText: "...", hashtags: [...] }
}
