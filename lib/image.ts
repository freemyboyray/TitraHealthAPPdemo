/**
 * Downscales and re-compresses an image for AI vision analysis, returning base64.
 *
 * GPT-4o-mini vision uses a single 512px tile at `detail: 'low'`, so 1024px wide
 * is more than enough detail. Resizing keeps the upload payload small (well under
 * the openai-proxy vision cap) and makes the request faster and cheaper.
 *
 * Uses a lazy require (like lib/healthkit.ts) so that a dev client predating this
 * native dependency degrades gracefully instead of crashing the whole app at
 * import time — on failure this throws and callers fall back to the raw base64.
 */
export async function resizeImageForVision(uri: string): Promise<string> {
  // Lazy require: never touch the native module at import time.
  const ImageManipulator = require('expo-image-manipulator');
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1024 } }],
    { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true },
  );
  return result.base64 ?? '';
}
