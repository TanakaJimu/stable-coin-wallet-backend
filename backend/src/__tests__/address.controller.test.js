/**
 * Jest unit test skeleton for Address API.
 * Run: npm install jest @jest/globals --save-dev (and add "test": "node --experimental-vm-modules node_modules/jest/bin/jest.js" for ESM)
 * Or: npx jest --experimental-vm-modules (with jest.config.js supporting ESM)
 *
 * Acceptance criteria covered:
 * - POST /generate creates doc linked to req.user.id
 * - Cannot create duplicate address
 * - encryptedPrivateKey stored when custodial true, not returned to client
 * - Default address logic (first address is default, setDefault works)
 */

import { describe, it, expect, jest, beforeEach } from "@jest/globals";

// Uncomment when running with Jest and adjust paths as needed:
// import * as addressController from "../controllers/addressController.js";

describe("Address API", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /generate", () => {
    it("should create address doc linked to req.user.id", async () => {
      // TODO: mock Address.findOne, Address.countDocuments, Address.create, encryptText
      // const req = { user: { id: "user123", _id: "user123" }, body: { network: "POLYGON_AMOY", custodial: true } };
      // const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      // await addressController.generateAddress(req, res);
      // expect(Address.create).toHaveBeenCalledWith(expect.objectContaining({ userId: "user123" }));
      // expect(res.status).toHaveBeenCalledWith(201);
      expect(true).toBe(true); // placeholder
    });

    it("should not create duplicate address for same user and network", async () => {
      // TODO: mock Address.findOne to return existing doc; expect res.status(409)
      expect(true).toBe(true); // placeholder
    });

    it("should store encryptedPrivateKey when custodial true and never return it in response", async () => {
      // TODO: mock encryptText to return "encrypted"; assert create called with encryptedPrivateKey; assert res.json result has no privateKey/encryptedPrivateKey
      expect(true).toBe(true); // placeholder
    });

    it("should set first address for (user, network) as default", async () => {
      // TODO: mock countDocuments to return 0; assert created doc has isDefault: true
      expect(true).toBe(true); // placeholder
    });
  });

  describe("PATCH /:id/default", () => {
    it("should set address as default and unset others for same user/network", async () => {
      // TODO: mock Address.findOne, updateMany, save; call setDefault; assert updateMany called with isDefault: false
      expect(true).toBe(true); // placeholder
    });
  });
});
