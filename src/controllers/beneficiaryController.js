import Beneficiary from "../models/beneficiary.model.js";
import { writeAuditLog } from "../middlewares/auditLog.js";

export async function createBeneficiary(req, res) {
  try {
    const userId = req.user.id;
    const { nickname, address, asset, network, isWhitelisted = false, note } = req.body;

    if (!nickname || !address || !asset || !network) {
      return res.status(400).json({ message: "nickname, address, asset, network are required" });
    }

    const doc = await Beneficiary.create({
      userId,
      nickname,
      address,
      asset,
      network,
      isWhitelisted,
      note,
    });

    await writeAuditLog({
      userId,
      action: "BENEFICIARY_CREATED",
      entityType: "beneficiary",
      entityId: doc._id,
      req,
      meta: { asset: doc.asset, network: doc.network, whitelisted: doc.isWhitelisted },
    });

    return res.status(201).json(doc);
  } catch (e) {
    if (e?.code === 11000) {
      return res.status(409).json({ message: "Beneficiary already exists" });
    }
    return res.status(500).json({ message: "Failed to create beneficiary", error: e.message });
  }
}

export async function listBeneficiaries(req, res) {
  try {
    const userId = req.user.id;
    const { asset, network, q } = req.query;

    const filter = { userId };
    if (asset) filter.asset = String(asset).toUpperCase();
    if (network) filter.network = String(network).toUpperCase();

    if (q) {
      const s = String(q).trim();
      filter.$or = [{ nickname: new RegExp(s, "i") }, { address: new RegExp(s, "i") }];
    }

    const items = await Beneficiary.find(filter).sort({ updatedAt: -1 });
    return res.json(items);
  } catch (e) {
    return res.status(500).json({ message: "Failed to list beneficiaries", error: e.message });
  }
}

export async function updateBeneficiary(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const allowed = ["nickname", "note", "isWhitelisted"];
    const patch = {};
    for (const k of allowed) if (k in req.body) patch[k] = req.body[k];

    const updated = await Beneficiary.findOneAndUpdate({ _id: id, userId }, { $set: patch }, { new: true });
    if (!updated) return res.status(404).json({ message: "Beneficiary not found" });

    await writeAuditLog({
      userId,
      action: "BENEFICIARY_UPDATED",
      entityType: "beneficiary",
      entityId: updated._id,
      req,
      meta: patch,
    });

    return res.json(updated);
  } catch (e) {
    return res.status(500).json({ message: "Failed to update beneficiary", error: e.message });
  }
}

export async function deleteBeneficiary(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const deleted = await Beneficiary.findOneAndDelete({ _id: id, userId });
    if (!deleted) return res.status(404).json({ message: "Beneficiary not found" });

    await writeAuditLog({
      userId,
      action: "BENEFICIARY_DELETED",
      entityType: "beneficiary",
      entityId: deleted._id,
      req,
    });

    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ message: "Failed to delete beneficiary", error: e.message });
  }
}
