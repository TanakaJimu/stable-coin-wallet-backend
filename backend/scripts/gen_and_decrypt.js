/**
 * DEV ONLY: Demonstrate custodial wallet generation + encrypt/decrypt without touching DB.
 * Run from backend/: node scripts/gen_and_decrypt.js
 * Requires MASTER_KEY in .env (e.g. MASTER_KEY=your-32-char-secret-key-here).
 */
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { resolve, dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "..", ".env") });

import { createRandomWallet } from "../src/services/walletGen.service.js";
import { encryptPrivateKey, decryptPrivateKey } from "../src/services/crypto.service.js";

async function main() {
  if (!process.env.MASTER_KEY) {
    console.error("Set MASTER_KEY in backend/.env (min 16 chars). Example: MASTER_KEY=dev-master-key-32-chars-long!!");
    process.exit(1);
  }

  console.log("1. Generating random wallet (ethers Wallet.createRandom)...");
  const { address, privateKey } = createRandomWallet();
  console.log("   Address:", address);
  console.log("   PrivateKey:", privateKey.slice(0, 10) + "...");

  console.log("\n2. Encrypting private key (AES-256-GCM, scrypt from MASTER_KEY)...");
  const encrypted = encryptPrivateKey(privateKey);
  console.log("   Encrypted payload keys:", Object.keys(encrypted));

  console.log("\n3. Decrypting back to plaintext...");
  const decrypted = decryptPrivateKey(encrypted);
  console.log("   Decrypted matches:", decrypted === privateKey ? "YES" : "NO");

  console.log("\nDone. (Safe for dev only; never log full keys in production.)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
