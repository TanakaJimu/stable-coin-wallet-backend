import { resolve } from "path";
import dotenv from "dotenv";
import { ethers } from "ethers";

dotenv.config({
  path: resolve(process.cwd(), ".env"),
  override: true,
});

async function main() {
  console.log("CWD:", process.cwd());
  console.log("RPC:", process.env.BLOCKCHAIN_RPC_URL);

  const p = new ethers.JsonRpcProvider(process.env.BLOCKCHAIN_RPC_URL);
  const n = await p.getNetwork();
  console.log("Connected chainId:", n.chainId);
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
