import { describe, it, expect } from 'vitest';
import { encryptMessage, decryptMessage, generateStrongPassword, evaluatePasswordStrength } from '../src/crypto/engine.js';
import { embedDataInImage, extractDataFromImage } from '../src/stego/stegoEngine.js';

describe('AuraCipher Cryptographic Engine', () => {
  const secretData = 'Top Secret Transmission: Coordinate 41.0082, 28.9784';
  const passphrase = 'SuperSecureMasterPassword!2026';

  it('successfully encrypts and decrypts with correct passphrase', async () => {
    const encrypted = await encryptMessage(secretData, passphrase);
    expect(encrypted).toBeTypeOf('string');
    
    const parsed = JSON.parse(encrypted);
    expect(parsed.algo).toBe('AES-256-GCM');
    expect(parsed.kdf).toBe('PBKDF2-SHA256');
    expect(parsed.data).toBeDefined();

    const decrypted = await decryptMessage(encrypted, passphrase);
    expect(decrypted).toBe(secretData);
  });

  it('fails decryption when provided incorrect passphrase', async () => {
    const encrypted = await encryptMessage(secretData, passphrase);
    await expect(decryptMessage(encrypted, 'WrongPassphrase123!')).rejects.toThrow();
  });

  it('enforces minimum passphrase security standards', async () => {
    await expect(encryptMessage('test', '123')).rejects.toThrow('Passphrase must be at least 6 characters');
  });

  it('generates secure random passwords with accurate entropy calculation', () => {
    const pwd = generateStrongPassword(24);
    expect(pwd.length).toBe(24);
    const strength = evaluatePasswordStrength(pwd);
    expect(strength.score).toBeGreaterThanOrEqual(3);
  });
});

describe('AuraCipher Steganography Engine', () => {
  it('embeds and accurately recovers payload from pixel buffer without data loss', () => {
    const width = 100;
    const height = 100;
    const buffer = new Uint8ClampedArray(width * height * 4);
    // Fill with sample RGB pattern
    for (let i = 0; i < buffer.length; i += 4) {
      buffer[i] = 120;     // R
      buffer[i + 1] = 150; // G
      buffer[i + 2] = 200; // B
      buffer[i + 3] = 255; // A
    }

    const mockImageData = {
      width,
      height,
      data: buffer
    };

    const hiddenText = 'Zero-Knowledge Cryptographic Stego Payload #101';
    embedDataInImage(mockImageData, hiddenText);

    const recovered = extractDataFromImage(mockImageData);
    expect(recovered).toBe(hiddenText);
  });
});
