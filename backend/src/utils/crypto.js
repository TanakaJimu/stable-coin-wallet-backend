import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LEN = 12;
const KEY_LEN = 32;

/**
 * Get encryption key from env. Throws if missing or too short.
 * Production: use HSM or external KMS for key custody.
 */
function getKey() {
  const raw = process.env.WALLET_ENC_KEY;
  if (!raw || typeof raw !== "string") {
    throw new Error("WALLET_ENC_KEY must be set in .env (32+ characters). Never commit this key.");
  }
  const buf = Buffer.from(raw, "utf8");
  if (buf.length < 32) {
    throw new Error("WALLET_ENC_KEY must be at least 32 characters.");
  }
  return buf.slice(0, 32);
}

/**
 * AES-256-GCM encrypt. Returns string: ivHex.tagHex.cipherHex
 * @param {string} plain - Plaintext (e.g. private key)
 * @returns {string}
 */
export function encryptText(plain) {
  if (!plain || typeof plain !== "string") throw new Error("Plaintext is required");
  const key = getKey();
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}.${tag.toString("hex")}.${enc.toString("hex")}`;
}

/**
 * AES-256-GCM decrypt. Payload format: ivHex.tagHex.cipherHex
 * @param {string} payload
 * @returns {string}
 */
export function decryptText(payload) {
  if (!payload || typeof payload !== "string") throw new Error("Payload is required");
  const parts = payload.split(".");
  if (parts.length !== 3) throw new Error("Invalid payload format (expected ivHex.tagHex.cipherHex)");
  const [ivHex, tagHex, cipherHex] = parts;
  const key = getKey();
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const enc = Buffer.from(cipherHex, "hex");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}
