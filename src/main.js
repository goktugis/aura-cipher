import { encryptMessage, decryptMessage, generateStrongPassword, evaluatePasswordStrength } from './crypto/engine.js';
import { embedDataInImage, extractDataFromImage } from './stego/stegoEngine.js';

// DOM Elements - Navigation
const tabButtons = document.querySelectorAll('.tab-btn');
const tabPanes = document.querySelectorAll('.tab-pane');

tabButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    tabButtons.forEach(b => b.classList.remove('active'));
    tabPanes.forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const target = btn.getAttribute('data-tab');
    document.getElementById(target)?.classList.add('active');
  });
});

// Tab 1: Encryption & Decryption
const encryptInput = document.getElementById('encrypt-input');
const encryptPass = document.getElementById('encrypt-passphrase');
const toggleEncryptPass = document.getElementById('toggle-encrypt-pass');
const encryptMeter = document.getElementById('encrypt-meter');
const encryptMeterText = document.getElementById('encrypt-meter-text');
const btnEncrypt = document.getElementById('btn-encrypt-action');
const encryptResultGroup = document.getElementById('encrypt-result-group');
const encryptOutput = document.getElementById('encrypt-output');
const copyEncryptResult = document.getElementById('copy-encrypt-result');

const decryptInput = document.getElementById('decrypt-input');
const decryptPass = document.getElementById('decrypt-passphrase');
const toggleDecryptPass = document.getElementById('toggle-decrypt-pass');
const btnDecrypt = document.getElementById('btn-decrypt-action');
const decryptResultGroup = document.getElementById('decrypt-result-group');
const decryptOutput = document.getElementById('decrypt-output');
const copyDecryptResult = document.getElementById('copy-decrypt-result');

// Password toggle helper
function setupPasswordToggle(input, button) {
  button.addEventListener('click', () => {
    if (input.type === 'password') {
      input.type = 'text';
      button.textContent = 'Hide';
    } else {
      input.type = 'password';
      button.textContent = 'Show';
    }
  });
}
setupPasswordToggle(encryptPass, toggleEncryptPass);
setupPasswordToggle(decryptPass, toggleDecryptPass);

// Password strength indicator
encryptPass.addEventListener('input', () => {
  const val = encryptPass.value;
  const strength = evaluatePasswordStrength(val);
  const colors = ['#f43f5e', '#f43f5e', '#f59e0b', '#10b981', '#06b6d4'];
  const widths = ['0%', '25%', '50%', '75%', '100%'];

  encryptMeter.style.width = widths[strength.score];
  encryptMeter.style.backgroundColor = colors[strength.score];
  encryptMeterText.textContent = `Strength: ${strength.label} (~${strength.entropy} bits entropy)`;
});

btnEncrypt.addEventListener('click', async () => {
  const plaintext = encryptInput.value.trim();
  const password = encryptPass.value;

  if (!plaintext) {
    alert('Please enter plaintext payload to encrypt.');
    return;
  }
  if (!password || password.length < 6) {
    alert('Please provide a passphrase of at least 6 characters.');
    return;
  }

  btnEncrypt.disabled = true;
  btnEncrypt.innerHTML = '<span>Computing AES-GCM & PBKDF2...</span>';

  try {
    const encryptedJson = await encryptMessage(plaintext, password);
    encryptOutput.value = encryptedJson;
    encryptResultGroup.style.display = 'block';
  } catch (err) {
    alert('Encryption error: ' + err.message);
  } finally {
    btnEncrypt.disabled = false;
    btnEncrypt.innerHTML = '<span>Seal Envelope</span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>';
  }
});

btnDecrypt.addEventListener('click', async () => {
  const payload = decryptInput.value.trim();
  const password = decryptPass.value;

  if (!payload) {
    alert('Please paste the envelope payload JSON.');
    return;
  }
  if (!password) {
    alert('Please enter the decryption passphrase.');
    return;
  }

  btnDecrypt.disabled = true;
  btnDecrypt.innerHTML = '<span>Deriving Key & Authenticating...</span>';

  try {
    const decrypted = await decryptMessage(payload, password);
    decryptOutput.value = decrypted;
    decryptResultGroup.style.display = 'block';
  } catch (err) {
    alert(err.message);
  } finally {
    btnDecrypt.disabled = false;
    btnDecrypt.innerHTML = '<span>Decrypt Payload</span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>';
  }
});

// Copy helpers
copyEncryptResult.addEventListener('click', () => {
  navigator.clipboard.writeText(encryptOutput.value);
  copyEncryptResult.textContent = 'Copied!';
  setTimeout(() => copyEncryptResult.textContent = 'Copy JSON', 2000);
});

copyDecryptResult.addEventListener('click', () => {
  navigator.clipboard.writeText(decryptOutput.value);
  copyDecryptResult.textContent = 'Copied!';
  setTimeout(() => copyDecryptResult.textContent = 'Copy', 2000);
});

// Tab 2: Steganography
const stegoDropzone = document.getElementById('stego-dropzone');
const stegoFileInput = document.getElementById('stego-file-input');
const stegoFilename = document.getElementById('stego-filename');
const stegoSecretText = document.getElementById('stego-secret-text');
const btnStegoEmbed = document.getElementById('btn-stego-embed');

const stegoExtractDropzone = document.getElementById('stego-extract-dropzone');
const stegoExtractInput = document.getElementById('stego-extract-input');
const stegoExtractFilename = document.getElementById('stego-extract-filename');
const btnStegoExtract = document.getElementById('btn-stego-extract');
const stegoExtractResultGroup = document.getElementById('stego-extract-result-group');
const stegoExtractOutput = document.getElementById('stego-extract-output');
const copyStegoResult = document.getElementById('copy-stego-result');

let loadedEmbedImage = null;
let loadedExtractImage = null;

stegoDropzone.addEventListener('click', () => stegoFileInput.click());
stegoFileInput.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (file) {
    stegoFilename.textContent = `Carrier: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => { loadedEmbedImage = img; };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }
});

btnStegoEmbed.addEventListener('click', () => {
  if (!loadedEmbedImage) {
    alert('Please select an image to use as carrier.');
    return;
  }
  const payload = stegoSecretText.value.trim();
  if (!payload) {
    alert('Please enter a secret message or envelope JSON to embed.');
    return;
  }

  const canvas = document.getElementById('hidden-canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = loadedEmbedImage.naturalWidth || loadedEmbedImage.width;
  canvas.height = loadedEmbedImage.naturalHeight || loadedEmbedImage.height;
  ctx.drawImage(loadedEmbedImage, 0, 0);

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  try {
    embedDataInImage(imgData, payload);
    ctx.putImageData(imgData, 0, 0);

    const downloadLink = document.createElement('a');
    downloadLink.download = 'aura_stego_carrier.png';
    downloadLink.href = canvas.toDataURL('image/png');
    downloadLink.click();
  } catch (err) {
    alert('Stego embedding failed: ' + err.message);
  }
});

stegoExtractDropzone.addEventListener('click', () => stegoExtractInput.click());
stegoExtractInput.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (file) {
    stegoExtractFilename.textContent = `Target: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => { loadedExtractImage = img; };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  }
});

btnStegoExtract.addEventListener('click', () => {
  if (!loadedExtractImage) {
    alert('Please select a carrier image to inspect.');
    return;
  }

  const canvas = document.getElementById('hidden-canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = loadedExtractImage.naturalWidth || loadedExtractImage.width;
  canvas.height = loadedExtractImage.naturalHeight || loadedExtractImage.height;
  ctx.drawImage(loadedExtractImage, 0, 0);

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  try {
    const recovered = extractDataFromImage(imgData);
    stegoExtractOutput.value = recovered;
    stegoExtractResultGroup.style.display = 'block';
  } catch (err) {
    alert('Extraction failed: ' + err.message);
  }
});

copyStegoResult.addEventListener('click', () => {
  navigator.clipboard.writeText(stegoExtractOutput.value);
  copyStegoResult.textContent = 'Copied!';
  setTimeout(() => copyStegoResult.textContent = 'Copy', 2000);
});

// Tab 3: Key Generator
const keyDisplay = document.getElementById('generated-key-display');
const btnGenerateKey = document.getElementById('btn-generate-key');
const btnCopyGeneratedKey = document.getElementById('btn-copy-generated-key');
const keyLengthSlider = document.getElementById('key-length-slider');
const keyLengthLabel = document.getElementById('key-length-label');

keyLengthSlider.addEventListener('input', () => {
  keyLengthLabel.textContent = keyLengthSlider.value;
});

btnGenerateKey.addEventListener('click', () => {
  const length = parseInt(keyLengthSlider.value, 10);
  const key = generateStrongPassword(length);
  keyDisplay.textContent = key;
});

btnCopyGeneratedKey.addEventListener('click', () => {
  if (keyDisplay.textContent && !keyDisplay.textContent.includes('Click Generate')) {
    navigator.clipboard.writeText(keyDisplay.textContent);
    btnCopyGeneratedKey.textContent = 'Copied!';
    setTimeout(() => btnCopyGeneratedKey.textContent = 'Copy', 2000);
  }
});
