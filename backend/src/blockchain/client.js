import { ethers } from "ethers";

export function getProvider() {
  const rpc = process.env.BLOCKCHAIN_RPC_URL;
  if (!rpc) throw new Error("BLOCKCHAIN_RPC_URL missing in env");
  return new ethers.JsonRpcProvider(rpc);
}

export function getSigner() {
  const pk = process.env.BACKEND_SIGNER_PRIVATE_KEY;
  if (!pk) return null; // allow read-only mode
  return new ethers.Wallet(pk, getProvider());
}
