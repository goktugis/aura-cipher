/**
 * Visual Steganography Engine (Least Significant Bit - LSB)
 * Allows embedding arbitrary encrypted payloads invisibly inside RGB image pixels.
 * Zero perceptual degradation with tamper detection.
 */

const MAGIC_HEADER = 'AURA_STEGO_V1:';

/**
 * Encodes text into binary bit string
 */
function textToBits(text) {
  const enc = new TextEncoder();
  const bytes = enc.encode(text);
  let bits = '';
  for (let i = 0; i < bytes.length; i++) {
    bits += bytes[i].toString(2).padStart(8, '0');
  }
  return bits;
}

/**
 * Decodes binary bit string into text
 */
function bitsToText(bits) {
  const bytes = [];
  for (let i = 0; i < bits.length; i += 8) {
    if (i + 8 <= bits.length) {
      bytes.push(parseInt(bits.substr(i, 8), 2));
    }
  }
  const dec = new TextDecoder();
  return dec.decode(new Uint8Array(bytes));
}

/**
 * Embeds text into ImageData using LSB of Red, Green, Blue channels (skipping Alpha).
 */
export function embedDataInImage(imageData, payloadText) {
  const fullPayload = MAGIC_HEADER + payloadText;
  const bits = textToBits(fullPayload);
  const data = imageData.data;

  // Max capacity: each pixel has 3 usable color channels (R, G, B)
  const maxCapacityBits = (data.length / 4) * 3;
  // Reserve 32 bits for the length prefix
  const lengthBits = bits.length.toString(2).padStart(32, '0');
  const allBits = lengthBits + bits;

  if (allBits.length > maxCapacityBits) {
    throw new Error(`Data size (${allBits.length} bits) exceeds carrier image capacity (${maxCapacityBits} bits).`);
  }

  let bitIndex = 0;
  for (let i = 0; i < data.length && bitIndex < allBits.length; i++) {
    // Skip Alpha channel (every 4th byte)
    if ((i + 1) % 4 === 0) continue;

    const bit = parseInt(allBits[bitIndex], 10);
    // Clear LSB and write new bit
    data[i] = (data[i] & 0xFE) | bit;
    bitIndex++;
  }

  return imageData;
}

/**
 * Extracts embedded data from ImageData
 */
export function extractDataFromImage(imageData) {
  const data = imageData.data;

  // Step 1: Extract the first 32 bits (payload length)
  let lengthBits = '';
  let channelIndex = 0;
  let byteIndex = 0;

  while (lengthBits.length < 32 && byteIndex < data.length) {
    if ((byteIndex + 1) % 4 !== 0) {
      lengthBits += (data[byteIndex] & 1).toString();
    }
    byteIndex++;
  }

  const payloadBitLength = parseInt(lengthBits, 2);
  const maxPossibleBits = ((data.length / 4) * 3) - 32;

  if (isNaN(payloadBitLength) || payloadBitLength <= 0 || payloadBitLength > maxPossibleBits) {
    throw new Error('No valid steganographic Aura payload found in this image.');
  }

  // Step 2: Extract payload bits
  let payloadBits = '';
  while (payloadBits.length < payloadBitLength && byteIndex < data.length) {
    if ((byteIndex + 1) % 4 !== 0) {
      payloadBits += (data[byteIndex] & 1).toString();
    }
    byteIndex++;
  }

  const extractedText = bitsToText(payloadBits);

  if (!extractedText.startsWith(MAGIC_HEADER)) {
    throw new Error('Image contains data, but does not match AuraCipher signature.');
  }

  return extractedText.substring(MAGIC_HEADER.length);
}
