/**
 * Downscales and re-compresses an image for AI vision analysis, returning base64.
 *
 * GPT-4o-mini vision uses a single 512px tile at `detail: 'low'`, so 1024px wide
 * is more than enough detail. Resizing keeps the upload payload small (well under
 * the openai-proxy vision cap) and makes the request faster and cheaper.
 *
 * Returns empty string when the native module isn't available (e.g. dev client
 * built before this dependency was added) — callers fall back to raw base64.
 */
import { NativeModules } from 'react-native';

const hasNative = !!NativeModules.ExpoImageManipulator;

export async function resizeImageForVision(uri: string): Promise<string> {
  if (!hasNative) return '';
  try {
    const ImageManipulator = require('expo-image-manipulator');
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1024 } }],
      { compress: 0.6, format: ImageManipulator.SaveFormat?.JPEG ?? 'jpeg', base64: true },
    );
    return result.base64 ?? '';
  } catch {
    return '';
  }
}
