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

/** Read-only: provider. Write: signer (requires BACKEND_SIGNER_PRIVATE_KEY). */
export function getRunner({ write = false } = {}) {
  if (write) {
    const signer = getSigner();
    if (!signer) throw new Error("BACKEND_SIGNER_PRIVATE_KEY required for write");
    return signer;
  }
  return getProvider();
}
