import crypto from "crypto";

/**
 * Custodial encryption for private keys.
 * Uses MASTER_KEY from env; derives key with scrypt + salt. AES-256-GCM with random IV.
 *
 * PRODUCTION: Use KMS for MASTER_KEY (AWS KMS, GCP KMS, HashiCorp Vault).
 * Rotate MASTER_KEY via KMS key versioning; re-encrypt secrets when rotating.
 */
const ALGORITHM = process.env.ENCRYPTION_ALGO || "aes-256-gcm";
const SALT_LEN = 16;
const IV_LEN = 12; // 96 bits recommended for GCM
const KEY_LEN = 32;
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const AAD = Buffer.from("stable-wallet-v1", "utf8");

function getMasterKey() {
  const key = process.env.MASTER_KEY;
  if (!key || key.length < 16) {
    throw new Error("MASTER_KEY must be set in .env (min 16 chars). Use KMS in production.");
  }
  return key;
}

/**
 * Derive a 32-byte key from MASTER_KEY + salt using scrypt.
 */
function deriveKey(salt) {
  const master = getMasterKey();
  return crypto.scryptSync(master, salt, KEY_LEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
}

/**
 * Encrypt a plaintext private key. Returns object to store in DB.
 * @param {string} plainKey - Private key (0x-prefixed hex string)
 * @returns {{ cipherText: string, salt: string, iv: string, tag: string }}
 */
export function encryptPrivateKey(plainKey) {
  if (!plainKey || typeof plainKey !== "string") {
    throw new Error("plainKey is required");
  }
  const salt = crypto.randomBytes(SALT_LEN);
  const iv = crypto.randomBytes(IV_LEN);
  const key = deriveKey(salt);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(AAD);
  let cipherText = cipher.update(plainKey, "utf8");
  cipherText = Buffer.concat([cipherText, cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    cipherText: cipherText.toString("base64"),
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  };
}

/**
 * Decrypt stored encrypted payload back to plaintext private key.
 * @param {{ cipherText: string, salt: string, iv: string, tag: string }} encryptedObject
 * @returns {string} Plaintext private key
 */
export function decryptPrivateKey(encryptedObject) {
  if (!encryptedObject || !encryptedObject.cipherText || !encryptedObject.salt || !encryptedObject.iv || !encryptedObject.tag) {
    throw new Error("Invalid encrypted object: missing cipherText, salt, iv, or tag");
  }
  const salt = Buffer.from(encryptedObject.salt, "base64");
  const iv = Buffer.from(encryptedObject.iv, "base64");
  const tag = Buffer.from(encryptedObject.tag, "base64");
  const cipherText = Buffer.from(encryptedObject.cipherText, "base64");
  const key = deriveKey(salt);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAAD(AAD);
  decipher.setAuthTag(tag);
  let plain = decipher.update(cipherText);
  plain = Buffer.concat([plain, decipher.final()]);
  return plain.toString("utf8");
}
