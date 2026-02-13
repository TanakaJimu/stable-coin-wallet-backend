import Wallet from "../models/wallet.js";
import WalletAddress from "../models/walletAddressModel.js";
import NftMint from "../models/nftMint.js";
import { normAddress } from "../utils/chain.js";
import * as nftService from "../services/nftService.js";

const CHAIN_ID_AMOY = 80002;

/** Check if address belongs to user (any of user's wallets). Returns { walletId } or null. */
async function addressBelongsToUser(userId, address) {
  const wallets = await Wallet.find({ userId }).select("_id");
  const walletIds = wallets.map((w) => w._id);
  const wa = await WalletAddress.findOne({
    walletId: { $in: walletIds },
    address: normAddress(address) || address,
  });
  return wa ? { walletId: wa.walletId } : null;
}

/**
 * GET /api/nft/info
 * Returns WalletNFT mint info: price, supply, active flag.
 */
export async function getMintInfo(req, res) {
  try {
    const data = await nftService.getMintInfo();
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

/**
 * POST /api/nft/mint
 * Dual mode:
 * - On-chain: Body includes { txHash }. Backend verifies mint tx (ERC721 Transfer from 0 to user), records NftMint, returns mode: "onchain".
 * - Backend mint: Body { tokenUri, toAddress? }. Backend signer mints and optionally transfers. Returns mode: "backend".
 */
export async function mint(req, res) {
  try {
    const { tokenUri, toAddress, txHash: bodyTxHash } = req.body || {};

    if (bodyTxHash && String(bodyTxHash).trim().startsWith("0x")) {
      const existing = await NftMint.findOne({ txHash: String(bodyTxHash).trim().toLowerCase() });
      if (existing) {
        return res.status(409).json({
          success: false,
          error: "Transaction already processed",
          txHash: bodyTxHash,
          mode: "onchain",
        });
      }
      let verified;
      try {
        verified = await nftService.verifyMintOnChain({
          txHash: bodyTxHash,
          expectedTo: null,
        });
      } catch (err) {
        return res.status(400).json({
          success: false,
          error: "Verification failed",
          detail: err.message,
          mode: "onchain",
        });
      }
      const belongs = await addressBelongsToUser(req.user.id, verified.to);
      if (!belongs) {
        return res.status(403).json({
          success: false,
          error: "Mint recipient does not belong to this user",
          mode: "onchain",
        });
      }
      const nftAddress = nftService.getWalletNftAddress();
      await NftMint.create({
        userId: req.user._id || req.user.id,
        tokenId: verified.tokenId,
        txHash: String(bodyTxHash).trim().toLowerCase(),
        contractAddress: nftAddress ? normAddress(nftAddress) : undefined,
        chainId: CHAIN_ID_AMOY,
        mintedTo: normAddress(verified.to),
      });
      return res.status(201).json({
        success: true,
        data: { tokenId: verified.tokenId, txHash: bodyTxHash, to: verified.to },
        mode: "onchain",
      });
    }

    if (!tokenUri || typeof tokenUri !== "string") {
      return res.status(400).json({ success: false, error: "Missing or invalid tokenUri" });
    }
    const result = await nftService.mintNft({ tokenUri, toAddress });
    res.json({ success: true, data: result, mode: "backend" });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}
