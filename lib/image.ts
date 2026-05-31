import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

/**
 * Downscales and re-compresses an image for AI vision analysis, returning base64.
 *
 * GPT-4o-mini vision uses a single 512px tile at `detail: 'low'`, so 1024px wide
 * is more than enough detail. Resizing keeps the upload payload small (well under
 * the openai-proxy vision cap) and makes the request faster and cheaper. Callers
 * should keep the raw base64 as a fallback in case manipulation fails.
 */
export async function resizeImageForVision(uri: string): Promise<string> {
  const result = await manipulateAsync(
    uri,
    [{ resize: { width: 1024 } }],
    { compress: 0.6, format: SaveFormat.JPEG, base64: true },
  );
  return result.base64 ?? '';
}
