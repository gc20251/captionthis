// src/lib/generate.js
//
// Turns a File into base64 and calls the Supabase Edge Function.
// The function URL + anon key come from Vite env vars (see .env.example).

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-captions`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Read a File as raw base64 (strips the "data:image/...;base64," prefix).
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
}

export async function generateCaptions(file, tone) {
  const image = await fileToBase64(file);

  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify({ image, mediaType: file.type, tone }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Something went wrong generating captions.");
  }
  return data; // { captions: [...], altText: "...", hashtags: [...] }
}
