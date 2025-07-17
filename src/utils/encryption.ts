/**
 * Simple encryption/decryption utility for PIN-protected QR codes
 * Uses a basic XOR cipher with PIN-based key derivation
 */

/**
 * Derives a key from the PIN by repeating it to match the data length
 */
function deriveKey(pin: string, length: number): string {
  if (!pin || pin.length === 0) {
    throw new Error('PIN cannot be empty');
  }
  
  let key = '';
  for (let i = 0; i < length; i++) {
    key += pin[i % pin.length];
  }
  return key;
}

/**
 * Encrypts data using XOR cipher with PIN-based key
 */
export function encryptData(data: string, pin: string): string {
  if (!data || !pin) {
    throw new Error('Data and PIN are required for encryption');
  }
  
  const key = deriveKey(pin, data.length);
  let encrypted = '';
  
  for (let i = 0; i < data.length; i++) {
    const dataChar = data.charCodeAt(i);
    const keyChar = key.charCodeAt(i);
    const encryptedChar = dataChar ^ keyChar;
    encrypted += String.fromCharCode(encryptedChar);
  }
  
  // Convert to base64 to ensure it's safe for QR codes
  return btoa(encrypted);
}

/**
 * Decrypts data using XOR cipher with PIN-based key
 */
export function decryptData(encryptedData: string, pin: string): string {
  if (!encryptedData || !pin) {
    throw new Error('Encrypted data and PIN are required for decryption');
  }
  
  try {
    // Decode from base64
    const encrypted = atob(encryptedData);
    const key = deriveKey(pin, encrypted.length);
    let decrypted = '';
    
    for (let i = 0; i < encrypted.length; i++) {
      const encryptedChar = encrypted.charCodeAt(i);
      const keyChar = key.charCodeAt(i);
      const decryptedChar = encryptedChar ^ keyChar;
      decrypted += String.fromCharCode(decryptedChar);
    }
    
    return decrypted;
  } catch (error) {
    throw new Error('Failed to decrypt data. Invalid encrypted data or incorrect PIN.');
  }
}

/**
 * Validates if a string is a valid PIN (4-6 digits)
 */
export function isValidPin(pin: string): boolean {
  return /^\d{4,6}$/.test(pin);
}

/**
 * Generates a secure random PIN
 */
export function generateSecurePin(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
} 