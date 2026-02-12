/**
 * Ethers provider and signer for backend.
 * Production: use KMS/HSM for OPERATOR_PRIVATE_KEY; dev: use env (e.g. BACKEND_SIGNER_PRIVATE_KEY).
 */
import { ethers } from "ethers";

export function getProvider() {
  const rpc = process.env.BLOCKCHAIN_RPC_URL || process.env.RPC_URL;
  if (!rpc) throw new Error("BLOCKCHAIN_RPC_URL or RPC_URL missing in env");
  return new ethers.JsonRpcProvider(rpc);
}

/** Alias for getProvider (read-only). */
export const readOnlyProvider = getProvider;

export function getSigner() {
  const pk = process.env.OPERATOR_PRIVATE_KEY || process.env.BACKEND_SIGNER_PRIVATE_KEY;
  if (!pk) return null;
  return new ethers.Wallet(pk, getProvider());
}

/** write=true => signer (for withdraw/swap/mint); write=false => provider. */
export function getRunner({ write = false } = {}) {
  if (write) {
    const signer = getSigner();
    if (!signer) throw new Error("OPERATOR_PRIVATE_KEY or BACKEND_SIGNER_PRIVATE_KEY required for write");
    return signer;
  }
  return getProvider();
}
