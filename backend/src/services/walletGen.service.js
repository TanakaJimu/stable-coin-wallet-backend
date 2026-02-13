import { Wallet } from "ethers";

/**
 * Generate a new Ethereum-style address (MetaMask-compatible) using ethers v6.
 * Controller must encrypt the private key immediately and never persist plaintext.
 */
export function createRandomWallet() {
  const wallet = Wallet.createRandom();
  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
    // mnemonic available only at creation; not stored for security
    mnemonic: wallet.mnemonic ? wallet.mnemonic.phrase : undefined,
  };
}
