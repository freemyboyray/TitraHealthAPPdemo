/**
 * Encrypted AsyncStorage adapter for Supabase session tokens.
 *
 * Uses expo-crypto to encrypt values at rest while keeping the AsyncStorage
 * API contract that Supabase expects. The encryption key is derived from a
 * device-bound secret stored in expo-secure-store (iOS Keychain / Android Keystore).
 *
 * Why not use SecureStore directly for session storage?
 * SecureStore uses `kSecAttrAccessibleWhenUnlocked` — during OAuth the app is
 * backgrounded by the browser, making the Keychain inaccessible on return.
 * This wrapper keeps values accessible (AsyncStorage) but encrypted.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

const KEY_ALIAS = 'titrahealth_storage_key';
const IV_LENGTH = 12;

// ── Helpers: base64 encode/decode without Buffer ──────────────────────────

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function bytesToBase64(bytes: Uint8Array): string {
  let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = bytes[i + 1] ?? 0;
    const b2 = bytes[i + 2] ?? 0;
    result += B64[(b0 >> 2)];
    result += B64[((b0 & 3) << 4) | (b1 >> 4)];
    result += i + 1 < bytes.length ? B64[((b1 & 15) << 2) | (b2 >> 6)] : '=';
    result += i + 2 < bytes.length ? B64[(b2 & 63)] : '=';
  }
  return result;
}

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/=+$/, '');
  const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let j = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const c0 = B64.indexOf(clean[i]);
    const c1 = B64.indexOf(clean[i + 1]);
    const c2 = B64.indexOf(clean[i + 2]);
    const c3 = B64.indexOf(clean[i + 3]);
    bytes[j++] = (c0 << 2) | (c1 >> 4);
    if (c2 >= 0) bytes[j++] = ((c1 & 15) << 4) | (c2 >> 2);
    if (c3 >= 0) bytes[j++] = ((c2 & 3) << 6) | c3;
  }
  return bytes.slice(0, j);
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

// ── Key management ────────────────────────────────────────────────────────

async function getOrCreateKey(): Promise<string> {
  try {
    let key = await SecureStore.getItemAsync(KEY_ALIAS);
    if (!key) {
      const randomBytes = Crypto.getRandomBytes(32);
      const seed = Array.from(randomBytes).map((b) => b.toString(16).padStart(2, '0')).join('');
      key = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, seed);
      await SecureStore.setItemAsync(KEY_ALIAS, key, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
    }
    return key;
  } catch {
    // Keychain unavailable (e.g. simulator without entitlements) — use a
    // deterministic fallback key. Less secure, but allows dev/testing to work.
    return Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      'titrahealth-dev-fallback-key',
    );
  }
}

let cachedKey: string | null = null;

async function getKey(): Promise<string> {
  if (!cachedKey) {
    cachedKey = await getOrCreateKey();
  }
  return cachedKey;
}

// ── Encryption (XOR with SHA-256 derived keystream) ───────────────────────
// The actual security boundary is the Keychain/Keystore-protected key.
// This provides confidentiality at rest for data stored in AsyncStorage.

async function deriveKeystream(key: string, iv: string, length: number): Promise<Uint8Array> {
  // Generate enough keystream blocks to cover the data
  const blocks: Uint8Array[] = [];
  let generated = 0;
  let counter = 0;
  while (generated < length) {
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `${key}:${iv}:${counter}`
    );
    blocks.push(hexToBytes(hash));
    generated += 32;
    counter++;
  }
  const full = new Uint8Array(generated);
  let offset = 0;
  for (const block of blocks) {
    full.set(block, offset);
    offset += block.length;
  }
  return full.slice(0, length);
}

async function encrypt(plaintext: string): Promise<string> {
  const key = await getKey();
  const ivBytes = Crypto.getRandomBytes(IV_LENGTH);
  const iv = Array.from(ivBytes).map((b) => b.toString(16).padStart(2, '0')).join('');

  // Encode plaintext to UTF-8 bytes
  const encoder = new TextEncoder();
  const plaintextBytes = encoder.encode(plaintext);

  // Derive keystream and XOR
  const keystream = await deriveKeystream(key, iv, plaintextBytes.length);
  const cipher = new Uint8Array(plaintextBytes.length);
  for (let i = 0; i < plaintextBytes.length; i++) {
    cipher[i] = plaintextBytes[i] ^ keystream[i];
  }

  return iv + ':' + bytesToBase64(cipher);
}

async function decrypt(ciphertext: string): Promise<string> {
  const colonIdx = ciphertext.indexOf(':');
  if (colonIdx === -1) return ciphertext; // Not encrypted, return as-is (migration)

  const iv = ciphertext.substring(0, colonIdx);
  const data = ciphertext.substring(colonIdx + 1);

  // Validate IV format (hex string of expected length)
  if (iv.length !== IV_LENGTH * 2 || !/^[0-9a-f]+$/.test(iv)) {
    return ciphertext; // Not our encrypted format
  }

  const key = await getKey();
  const cipherBytes = base64ToBytes(data);

  const keystream = await deriveKeystream(key, iv, cipherBytes.length);
  const plain = new Uint8Array(cipherBytes.length);
  for (let i = 0; i < cipherBytes.length; i++) {
    plain[i] = cipherBytes[i] ^ keystream[i];
  }

  const decoder = new TextDecoder();
  return decoder.decode(plain);
}

/**
 * Encrypted storage adapter compatible with Supabase's storage interface.
 */
export const EncryptedStorage = {
  async getItem(key: string): Promise<string | null> {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    try {
      return await decrypt(raw);
    } catch {
      // Fallback: value was stored before encryption was enabled
      return raw;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    const encrypted = await encrypt(value);
    await AsyncStorage.setItem(key, encrypted);
  },

  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
  },
};

/**
 * For web platform, just use plain storage (no native crypto available).
 */
export const SecureSessionStorage = Platform.OS === 'web' ? undefined : EncryptedStorage;
