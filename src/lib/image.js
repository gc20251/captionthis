// src/lib/image.js
//
// Turns a user-selected File into an API-ready base64 JPEG.
//
// Why this exists: a modern phone photo is ~12MP. Base64-encoded, that blows
// past the Anthropic image size ceiling (~5MB) and the request fails. So we
// downscale in the browser before it ever leaves the device. As a bonus this:
//   - honors EXIF orientation (phone shots are frequently rotated)
//   - strips metadata, including GPS coordinates, by re-encoding
//   - flattens transparency onto white so PNG/WebP alpha doesn't go black

// Anthropic downsizes anything with a long edge over 1568px server-side, so
// there's no quality gain in sending more than that — only wasted bytes/tokens.
export const MAX_EDGE = 1568;
export const JPEG_QUALITY = 0.85;

// Guard the main thread: decoding a 40MB TIFF can jank the tab. Reject early.
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB

// Only formats the vision API accepts. Everything sent onward becomes JPEG.
export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// Throws an Error with a human-readable message if the file is unusable.
// Kept separate so the dropzone can validate at selection time, before the
// heavier downscale work runs at generate time.
export function validateFile(file) {
  if (!file) {
    throw new Error("No file selected.");
  }

  if (!ACCEPTED_TYPES.includes(file.type)) {
    // .heic reports either "image/heic" or an empty type in most browsers.
    const looksHeic = /\.heic$|\.heif$/i.test(file.name) || /heic|heif/i.test(file.type);
    if (looksHeic) {
      throw new Error("HEIC isn't supported yet — export or share the photo as a JPEG and try again.");
    }
    throw new Error("Please use a JPEG, PNG, WebP, or GIF.");
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(0);
    throw new Error(`That image is ${mb}MB — too large to process. Try one under 25MB.`);
  }
}

// Compute the target dimensions that fit within MAX_EDGE while preserving
// aspect ratio. Never upscales.
function fitWithin(width, height, maxEdge) {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const scale = maxEdge / longest;
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

// Validates, downscales, and re-encodes to a base64 JPEG.
// Returns { data, mediaType, width, height } where data is raw base64
// (no "data:" prefix) ready for the Anthropic image block.
export async function prepareImage(file) {
  validateFile(file);

  // createImageBitmap decodes off the main thread and, with imageOrientation
  // "from-image", bakes EXIF rotation into the pixels so the canvas is upright.
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("That image couldn't be read. It may be corrupt — try another file.");
  }

  const { width, height } = fitWithin(bitmap.width, bitmap.height, MAX_EDGE);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  // Flatten transparency onto white so alpha channels don't render as black
  // once we drop to JPEG (which has no alpha).
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not encode the image."))),
      "image/jpeg",
      JPEG_QUALITY
    );
  });

  const data = await blobToBase64(blob);
  return { data, mediaType: "image/jpeg", width, height };
}

// Read a Blob as raw base64 (strips the "data:image/jpeg;base64," prefix).
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new Error("Could not read the image."));
    reader.readAsDataURL(blob);
  });
}
