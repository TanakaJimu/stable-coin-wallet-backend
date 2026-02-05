import * as chainWalletService from "../services/chainWalletService.js";

export async function summary(req, res) {
  try {
    // if you use auth, take user address from token/user record:
    const address = req.user?.walletAddress || req.query.address;
    if (!address) return res.status(400).json({ error: "Missing wallet address" });

    const data = await chainWalletService.getWalletSummary(address);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

export async function send(req, res) {
  try {
    const { to, amount } = req.body;
    if (!to || !amount) return res.status(400).json({ error: "Missing to/amount" });

    const result = await chainWalletService.sendToken({ to, amount });
    res.json({ success: true, tx: result });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}
