/**
 * Downscales and re-encodes an image to JPEG for AI vision analysis, returning base64.
 *
 * GPT-4o-mini vision uses a single 512px tile at `detail: 'low'`, so 1024px wide
 * is more than enough detail. Re-encoding to JPEG is also what makes the upload
 * actually work: iPhone cameras return HEIC, which OpenAI rejects with a 400
 * "unsupported image" error. Running every photo through the manipulator
 * guarantees a JPEG (one of OpenAI's accepted formats) and keeps the payload small.
 *
 * Returns an empty string only if the manipulation genuinely fails — callers must
 * treat that as an error (the raw image may be an unsupported format like HEIC and
 * must NOT be sent as-is).
 */
// Lazy-required inside the function so a missing/out-of-date native module
// (e.g. a dev client built before expo-image-manipulator was added) degrades
// this one feature instead of crashing the whole app at import time.
export async function resizeImageForVision(uri: string): Promise<string> {
  try {
    const { ImageManipulator, SaveFormat } = require('expo-image-manipulator');
    const context = ImageManipulator.manipulate(uri).resize({ width: 1024 });
    const image = await context.renderAsync();
    const result = await image.saveAsync({ compress: 0.6, format: SaveFormat.JPEG, base64: true });
    return result.base64 ?? '';
  } catch {
    return '';
  }
}
