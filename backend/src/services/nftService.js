import { getContracts } from "../blockchain/contracts.js";
import { ethers } from "ethers";

/**
 * Get WalletNFT mint info (read-only).
 * @returns {Promise<{ mintPrice: string, mintPriceWei: string, totalMinted: number, maxSupply: number, publicMintActive: boolean, contractAddress: string }>}
 */
export async function getMintInfo() {
  const { walletNFT, deployment } = getContracts({ write: false });
  const mintPriceWei = await walletNFT.mintPrice();
  const totalMinted = Number(await walletNFT.totalMinted());
  const maxSupply = Number(await walletNFT.maxSupply());
  const publicMintActive = await walletNFT.publicMintActive();
  const contractAddress = deployment.contracts?.WalletNFT ?? (await walletNFT.getAddress());

  return {
    contractAddress,
    mintPrice: ethers.formatUnits(mintPriceWei, 18),
    mintPriceWei: mintPriceWei.toString(),
    totalMinted,
    maxSupply,
    publicMintActive,
  };
}

/**
 * Mint a WalletNFT and optionally transfer to a recipient.
 * Backend signer pays mint price (must have SWC and have approved WalletNFT).
 * If toAddress is provided, NFT is transferred to that address; otherwise it stays with the backend signer.
 *
 * @param {{ tokenUri: string, toAddress?: string }} params
 * @returns {Promise<{ tokenId: number, txHash: string, to: string }>}
 */
export async function mintNft({ tokenUri, toAddress }) {
  const { walletNFT } = getContracts({ write: true });

  const tx = await walletNFT.mint(tokenUri || "");
  const receipt = await tx.wait();
  const totalMinted = Number(await walletNFT.totalMinted());
  const tokenId = totalMinted;
  const backendAddress = await walletNFT.ownerOf(tokenId);

  let finalOwner = backendAddress;
  if (toAddress && ethers.isAddress(toAddress) && toAddress.toLowerCase() !== backendAddress.toLowerCase()) {
    const transferTx = await walletNFT.transferFrom(backendAddress, toAddress, tokenId);
    await transferTx.wait();
    finalOwner = toAddress;
  }

  return {
    tokenId,
    txHash: receipt?.hash ?? tx.hash,
    to: finalOwner,
  };
}
