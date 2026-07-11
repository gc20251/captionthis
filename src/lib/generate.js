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

  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify({ image: data, mediaType, tone }),
  });

  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.error || "Something went wrong generating captions.");
  }
  return body; // { captions: [...], altText: "...", hashtags: [...] }
}
