# Custodial Secrets API (MetaMask-style address generation)

**Security:** This is custodial — the server holds encrypted private keys. Use **MASTER_KEY** from env; in production use KMS (AWS KMS, GCP KMS, HashiCorp Vault). Prefer non-custodial flows where possible.

All endpoints require **Authorization: Bearer &lt;access_token&gt;** (from `/api/auth/signin`).

**Important:** The API **generates** addresses; it does **not** accept user-supplied address or private key. Use **POST /api/secrets/createSecrets** or **POST /api/secrets/generate** to create a new address (same behavior).

---

## POST /api/secrets/createSecrets (or POST /api/secrets/generate)

Generate a new Ethereum-style address (ethers `Wallet.createRandom()`). **Do not send** `userAddress` or `privateKey` — the server creates the address. Private key is encrypted with MASTER_KEY and stored; a WalletAddress record is linked for receive/topup flows.

**Body (only these fields; walletId is generated/assigned by the backend):**

```json
{
  "network": "POLYGON_AMOY",
  "asset": "USDT",
  "label": "deposit-1",
  "setDefault": true
}
```

**Example curl (use either path — same behavior; do not send walletId):**

```bash
curl -X POST "http://localhost:5000/api/secrets/createSecrets" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
  "network": "POLYGON_AMOY",
  "asset": "USDT",
  "label": "deposit-1",
  "setDefault": true
}'
```

**Response 201:**

```json
{
  "success": true,
  "secretId": "<id>",
  "address": "0x...",
  "walletId": "...",
  "network": "POLYGON_AMOY",
  "asset": "USDT",
  "default": true,
  "isCustodial": true
}
```

| Field       | Description                                      |
|------------|---------------------------------------------------|
| walletId   | Wallet this address belongs to                    |
| network    | Network (e.g. POLYGON_AMOY)                       |
| asset      | Asset (e.g. USDT) if provided in request         |
| default    | Whether this address is the default for the user |

---

## GET /api/secrets

List custodial secrets for the authenticated user (address only; no private key).

**Example curl:**

```bash
curl -H "Authorization: Bearer <token>" "http://localhost:3000/api/secrets"
```

**Response 200:**

```json
{
  "success": true,
  "data": [
    {
      "secretId": "<id>",
      "address": "0x...",
      "network": "POLYGON_AMOY",
      "walletId": "...",
      "label": "deposit-1",
      "isDefault": true
    }
  ],
  "message": "Custodial secrets list"
}
```

---

## GET /api/secrets/:id

Get a single secret’s metadata (no private key). Must own the secret.

**Example curl:**

```bash
curl -H "Authorization: Bearer <token>" "http://localhost:3000/api/secrets/<id>"
```

**Response 200:**

```json
{
  "success": true,
  "data": {
    "secretId": "<id>",
    "address": "0x...",
    "network": "POLYGON_AMOY",
    "walletId": "...",
    "asset": "USDT",
    "label": "deposit-1",
    "isDefault": true,
    "isCustodial": true,
    "createdAt": "...",
    "lastUsedAt": null
  }
}
```

---

## POST /api/secrets/read-decrypted

Returns the **private key** only under strict conditions. Use for export (e.g. import into MetaMask).

**Requirements:**

- **x-confirm: true** header (or body `confirmHeader: true`)
- Body: `{ "secretId": "<id>", "reason": "import-to-metamask" }`
- Rate limited (e.g. 5 attempts per user per 15 minutes)
- All calls are audited (SECRETS_DECRYPTED)

**Example curl (dev):**

```bash
curl -X POST "http://localhost:3000/api/secrets/read-decrypted" \
  -H "Authorization: Bearer <token>" \
  -H "x-confirm: true" \
  -H "Content-Type: application/json" \
  -d '{"secretId":"<id>","reason":"import-to-metamask"}'
```

**Response 200:**

```json
{
  "success": true,
  "data": {
    "address": "0x...",
    "privateKey": "0x..."
  },
  "message": "..."
}
```

**Response 403 (missing confirm):**  
`"Decrypt requires explicit confirmation. Send header x-confirm: true or body confirmHeader: true. Rate limit applies."`

**Response 403 (rate limit):**  
`"Too many decrypt attempts. Try again later."`

---

## DELETE /api/secrets/:id

Soft-delete a custodial secret (encrypted data zeroed, address obfuscated, `deletedAt` set). Must own the secret.

**Example curl:**

```bash
curl -X DELETE "http://localhost:3000/api/secrets/<id>" \
  -H "Authorization: Bearer <token>"
```

**Response 200:**

```json
{
  "success": true,
  "data": null,
  "message": "Secret deleted"
}
```

---

## Import into MetaMask (dev walkthrough)

1. **Generate address:**  
   `POST /api/secrets/generate` with optional `label`, `setDefault: true`. Note `secretId` and `address`.

2. **Get private key (dev only):**  
   `POST /api/secrets/read-decrypted` with `x-confirm: true` and `{ "secretId": "<id>", "reason": "import-to-metamask" }`. Copy `privateKey` from the response.

3. **MetaMask:**  
   Profile → **Import account** → **Paste private key** → paste the key → Import.

4. **Add mock token:**  
   In MetaMask, add token by contract address (e.g. MockUSDT from `MOCK_USDT_ADDRESS` or `blockchain/deployments/amoy.json`).

---

## On-chain testing checklist

1. Deploy MockUSDT (and MockUSDC/MockSwap) to Polygon Amoy; set `MOCK_USDT_ADDRESS` etc. in `backend/.env` or ensure `tokenRegistry`/deployments are loaded.
2. Mint mock tokens to the generated address (e.g. `RECIPIENT=<address> npm run ... mint-mock-tokens` in `blockchain/scripts`).
3. Get deposit address: **GET /api/wallet/receive-address?asset=USDT&network=POLYGON** (backend returns the custodial address if it’s the user’s default for that asset/network).
4. From MetaMask (with the generated address), send MockUSDT to that receive address.
5. **POST /api/wallet/topup** with `txHash`, `amount`, `toAddress` to verify on-chain deposit and credit the ledger.
