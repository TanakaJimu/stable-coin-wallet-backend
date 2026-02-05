import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const ITERATIONS = 100000;

/**
 * Derive encryption key from password using PBKDF2
 * @param {string} password - The password to derive key from
 * @param {Buffer} salt - Salt for key derivation
 * @returns {Buffer} Derived key
 */
function deriveKey(password, salt) {
  return crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, "sha512");
}

/**
 * Encrypt sensitive data (like private keys)
 * @param {string} text - Text to encrypt
 * @param {string} password - Encryption password (should be from env)
 * @returns {string} Encrypted string in format: salt:iv:tag:encryptedData (all base64)
 */
export function encrypt(text, password) {
  if (!text || !password) {
    throw new Error("Text and password are required for encryption");
  }

  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = deriveKey(password, salt);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, "utf8", "base64");
  encrypted += cipher.final("base64");
  const tag = cipher.getAuthTag();

  // Return format: salt:iv:tag:encryptedData (all base64 encoded)
  return [
    salt.toString("base64"),
    iv.toString("base64"),
    tag.toString("base64"),
    encrypted,
  ].join(":");
}

/**
 * Decrypt sensitive data
 * @param {string} encryptedData - Encrypted string in format: salt:iv:tag:encryptedData
 * @param {string} password - Decryption password (should be from env)
 * @returns {string} Decrypted text
 */
export function decrypt(encryptedData, password) {
  if (!encryptedData || !password) {
    throw new Error("Encrypted data and password are required for decryption");
  }

  const parts = encryptedData.split(":");
  if (parts.length !== 4) {
    throw new Error("Invalid encrypted data format");
  }

  const [saltBase64, ivBase64, tagBase64, encrypted] = parts;
  const salt = Buffer.from(saltBase64, "base64");
  const key = deriveKey(password, salt);
  const iv = Buffer.from(ivBase64, "base64");
  const tag = Buffer.from(tagBase64, "base64");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encrypted, "base64", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

