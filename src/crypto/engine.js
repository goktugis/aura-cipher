/**
 * AuraCipher - Military-grade Client-Side Cryptographic Engine
 * Utilizes Web Crypto API (AES-GCM 256-bit + PBKDF2 with 100,000 iterations).
 * Absolute zero-knowledge: Keys and plaintexts never leave memory or reach any network.
 */

const PBKDF2_ITERATIONS = 100000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Derives a 256-bit AES-GCM CryptoKey from a passphrase and salt using PBKDF2
 */
export async function deriveKey(passphrase, salt, subtleCrypto = crypto.subtle) {
  const enc = new TextEncoder();
  const keyMaterial = await subtleCrypto.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return subtleCrypto.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts plaintext string with a passphrase.
 * Returns self-contained JSON string with salt, iv, and ciphertext.
 */
export async function encryptMessage(plaintext, passphrase, subtleCrypto = crypto.subtle) {
  if (!passphrase || passphrase.length < 6) {
    throw new Error('Passphrase must be at least 6 characters long.');
  }
  if (!plaintext) {
    throw new Error('Plaintext cannot be empty.');
  }

  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveKey(passphrase, salt, subtleCrypto);

  const enc = new TextEncoder();
  const encodedData = enc.encode(plaintext);

  const ciphertext = await subtleCrypto.encrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    key,
    encodedData
  );

  const payload = {
    v: 1,
    algo: 'AES-256-GCM',
    kdf: 'PBKDF2-SHA256',
    iter: PBKDF2_ITERATIONS,
    salt: bufferToBase64(salt),
    iv: bufferToBase64(iv),
    data: bufferToBase64(ciphertext)
  };

  return JSON.stringify(payload);
}

/**
 * Decrypts encrypted JSON payload with passphrase.
 */
export async function decryptMessage(encryptedPayload, passphrase, subtleCrypto = crypto.subtle) {
  if (!passphrase) {
    throw new Error('Passphrase required.');
  }

  let parsed;
  try {
    parsed = typeof encryptedPayload === 'string' ? JSON.parse(encryptedPayload) : encryptedPayload;
  } catch (e) {
    throw new Error('Invalid cryptographic envelope format.');
  }

  if (!parsed.salt || !parsed.iv || !parsed.data) {
    throw new Error('Corrupted or unsupported cryptographic envelope.');
  }

  const salt = base64ToBuffer(parsed.salt);
  const iv = base64ToBuffer(parsed.iv);
  const data = base64ToBuffer(parsed.data);

  const key = await deriveKey(passphrase, new Uint8Array(salt), subtleCrypto);

  try {
    const decryptedBuffer = await subtleCrypto.decrypt(
      {
        name: 'AES-GCM',
        iv: new Uint8Array(iv)
      },
      key,
      data
    );

    const dec = new TextDecoder();
    return dec.decode(decryptedBuffer);
  } catch (err) {
    throw new Error('Decryption failed. Incorrect passphrase or altered payload integrity.');
  }
}

/**
 * Generates cryptographically secure random password
 */
export function generateStrongPassword(length = 24) {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  let result = '';
  for (let i = 0; i < length; i++) {
    result += charset[values[i] % charset.length];
  }
  return result;
}

/**
 * Calculates password entropy and strength score
 */
export function evaluatePasswordStrength(password) {
  if (!password) return { score: 0, label: 'Empty', entropy: 0 };
  
  let poolSize = 0;
  if (/[a-z]/.test(password)) poolSize += 26;
  if (/[A-Z]/.test(password)) poolSize += 26;
  if (/[0-9]/.test(password)) poolSize += 10;
  if (/[^a-zA-Z0-9]/.test(password)) poolSize += 33;

  const entropy = Math.round(password.length * Math.log2(poolSize || 1));
  let score = 1;
  let label = 'Very Weak';

  if (entropy > 80 && password.length >= 14) {
    score = 4;
    label = 'Military Grade';
  } else if (entropy > 60 && password.length >= 10) {
    score = 3;
    label = 'Strong';
  } else if (entropy > 40 && password.length >= 8) {
    score = 2;
    label = 'Moderate';
  }

  return { score, label, entropy };
}
