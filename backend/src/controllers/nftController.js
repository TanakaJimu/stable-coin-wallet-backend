import * as nftService from "../services/nftService.js";

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
 * Body: { tokenUri: string, toAddress?: string }
 * Mints a WalletNFT (backend signer pays). Optionally transfers to toAddress.
 */
export async function mint(req, res) {
  try {
    const { tokenUri, toAddress } = req.body || {};
    if (!tokenUri || typeof tokenUri !== "string") {
      return res.status(400).json({ success: false, error: "Missing or invalid tokenUri" });
    }
    const result = await nftService.mintNft({ tokenUri, toAddress });
    res.json({ success: true, data: result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}
