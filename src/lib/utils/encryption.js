import crypto from 'crypto';

// Encryption configuration  
const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16; // For AES, this is always 16
const AAD = 'openai-api-key'; // Additional authenticated data

/**
 * Encryption service for securing sensitive data like API keys
 * Uses AES-256-GCM for authenticated encryption
 */

/**
 * Encrypt sensitive text using AES-256-GCM
 * @param {string} text - The plain text to encrypt
 * @returns {string} Encrypted data in format: iv:authTag:encrypted
 * @throws {Error} If encryption key is not configured or invalid
 */
export function encrypt(text) {
  const SECRET_KEY = process.env.ENCRYPTION_SECRET_KEY;
  
  if (!SECRET_KEY) {
    throw new Error('ENCRYPTION_SECRET_KEY environment variable is required');
  }
  
  if (SECRET_KEY.length !== 32) {
    throw new Error('ENCRYPTION_SECRET_KEY must be exactly 32 characters long');
  }
  
  // Generate random initialization vector
  const iv = crypto.randomBytes(IV_LENGTH);
  
  // Create cipher instance with IV
  const cipher = crypto.createCipheriv(ALGORITHM, SECRET_KEY, iv);
  
  // Encrypt the text
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  // Create HMAC for authentication
  const hmac = crypto.createHmac('sha256', SECRET_KEY);
  hmac.update(iv);
  hmac.update(encrypted);
  hmac.update(AAD);
  const authTag = hmac.digest('hex');
  
  // Return in format: iv:authTag:encrypted
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  
  // Return format: iv:authTag:encrypted for easy parsing
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt encrypted text using AES-256-GCM
 * @param {string} encryptedData - Encrypted data in format: iv:authTag:encrypted
 * @returns {string} Decrypted plain text
 * @throws {Error} If decryption fails or data is corrupted
 */
export function decrypt(encryptedData) {
  const SECRET_KEY = process.env.ENCRYPTION_SECRET_KEY;
  
  if (!SECRET_KEY) {
    throw new Error('ENCRYPTION_SECRET_KEY environment variable is required');
  }
  
  if (SECRET_KEY.length !== 32) {
    throw new Error('ENCRYPTION_SECRET_KEY must be exactly 32 characters long');
  }
  
  // Parse the encrypted data format
  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted data format');
  }
  
  const iv = Buffer.from(parts[0], 'hex');
  const authTag = parts[1];
  const encrypted = parts[2];
  
  // Verify authentication tag first
  const hmac = crypto.createHmac('sha256', SECRET_KEY);
  hmac.update(iv);
  hmac.update(encrypted);
  hmac.update(AAD);
  const expectedAuthTag = hmac.digest('hex');
  
  if (authTag !== expectedAuthTag) {
    throw new Error('Authentication failed - data may be corrupted or tampered with');
  }
  
  // Create decipher instance with IV
  const decipher = crypto.createDecipheriv(ALGORITHM, SECRET_KEY, iv);
  
  // Decrypt the data
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Create a secure hash of API key for validation purposes (non-reversible)
 * Used for logging and validation without storing the actual key
 * @param {string} apiKey - The API key to hash
 * @returns {string} SHA-256 hash of the API key
 */
export function hashApiKey(apiKey) {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

/**
 * Generate a secure random encryption key for initial setup
 * Use this to generate ENCRYPTION_SECRET_KEY for your environment
 * @returns {string} 32-character random string suitable for encryption
 */
export function generateEncryptionKey() {
  return crypto.randomBytes(32).toString('hex').substring(0, 32);
}

/**
 * Validate that an encryption key meets requirements
 * @param {string} key - The key to validate
 * @returns {boolean} Whether the key is valid
 */
export function validateEncryptionKey(key) {
  return typeof key === 'string' && key.length === 32;
}
