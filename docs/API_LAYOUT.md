# Stable Wallet Coin – API Layout

Base URL: `http://localhost:3000` (or `PORT` from `.env`)

**Auth:** Protected routes use `Authorization: Bearer <access_token>` (JWT from `/api/auth/signin`).

---

## Root & docs

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | No | Health check |
| GET | `/api` | No | API index (list of base paths + docs URLs) |
| GET | `/openapi.json` | No | OpenAPI 3 spec |
| GET | `/api-docs` | No | Swagger UI |
| GET | `/api-docs-redoc` | No | ReDoc UI |

---

## `/api/auth`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/signup` | No | Register (creates user + default wallet) |
| POST | `/api/auth/signin` | No | Login → returns JWT |
| POST | `/api/auth/signout` | Yes | Sign out (optional; stateless JWT) |

---

## `/api/wallet`

All routes under `/api/wallet` use **requireAuth** (JWT). Wallet + balances are ensured for the user.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/wallet/listWallets` | List wallets (paginated; query: `page`, `limit`) |
| POST | `/api/wallet/create` | Create another wallet (body: `name`, `isDefault`) |
| GET | `/api/wallet/summary` | Balances summary (all assets) |
| POST | `/api/wallet/add-asset` | Add asset to wallet (body: `asset`, `network`) |
| GET | `/api/wallet/receive-address` | Get deposit address (query: `asset`, `network`) |
| POST | `/api/wallet/topup` | Topup: on-chain (with `txHash`) or off-chain credit |
| POST | `/api/wallet/receive` | Receive: on-chain (with `txHash`) or off-chain credit |
| POST | `/api/wallet/send` | Send: on-chain (with `txHash`, `fromAddress`) or off-chain debit |
| POST | `/api/wallet/swap` | Swap: on-chain (with `txHash`) or off-chain ledger swap |
| GET | `/api/wallet/history` | Transaction history (query: `page`, `limit`, filters) |

Responses for topup/receive/send/swap include `mode: "onchain"` or `"offchain"` when applicable.

---

## `/api/beneficiary`

All routes require **requireAuth**.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/beneficiary` | List beneficiaries (query: `asset`, `network`, `q`) |
| POST | `/api/beneficiary` | Create beneficiary |
| PATCH | `/api/beneficiary/:id` | Update beneficiary |
| DELETE | `/api/beneficiary/:id` | Delete beneficiary |

---

## `/api/transactions`

All routes require **requireAuth** and an existing wallet.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/transactions` | List transactions (query: `page`, `limit`, filters) |
| GET | `/api/transactions/stats` | Transaction statistics |
| GET | `/api/transactions/:id` | Get transaction by ID |
| PATCH | `/api/transactions/:id/status` | Update transaction status |

---

## `/api/secrets`

All routes require **requireAuth**. Secrets are **mnemonic-based (HD wallet)** only; there is no API to generate random custodial addresses.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/secrets/readSecrets` | Read user secrets (UserSecret; address only) |
| GET | `/api/secrets/readDecryptedSecrets` | Read decrypted secrets (sensitive) |
| PUT | `/api/secrets/updateSecrets` | Update secrets |
| DELETE | `/api/secrets/deleteSecrets` | Delete secrets |
| POST | `/api/secrets/read-decrypted` | **HD Wallet:** return private key for derived address. Body: `{ address }`. Key is derived from mnemonic via HDNodeWallet. Requires `x-confirm: true`; rate limited. |
| POST | `/api/secrets/init-mnemonic` | **HD Wallet:** ensure user has one encrypted mnemonic (create if missing). Body optional: `network`. Response: `{ hasMnemonic, network, walletId }`. Never returns mnemonic. Requires MASTER_KEY. |
| POST | `/api/secrets/derive-address` | **HD Wallet:** derive next address at `m/44'/60'/0'/0/{index}`, store in WalletAddress. Body: `network`, `asset`, `label?`, `setDefault?`. Response: `{ address, index, walletId, network, asset, default, isCustodial }`. |
| GET | `/api/secrets/addresses` | **HD Wallet:** list stored derived addresses. Query: `network?`, `asset?`. Response: array of `{ address, index, asset, network, label, isDefault, createdAt }`. No mnemonic or private key. |

**HD Wallet:** One encrypted mnemonic per user (MASTER_KEY). Addresses derived at path `m/44'/60'/0'/0/{index}`. Private key is retrieved via HDNodeWallet from mnemonic when needed (read-decrypted). If MASTER_KEY is missing, init/derive/read-decrypted return **503**.

### Postman examples (HD Wallet)

1. **POST init-mnemonic** (ensure mnemonic exists)
   - **URL:** `POST {{baseUrl}}/api/secrets/init-mnemonic`
   - **Headers:** `Authorization: Bearer <access_token>`
   - **Body (optional):** `{ "network": "POLYGON_AMOY" }`
   - **Example response:** `{ "success": true, "message": "Mnemonic ready", "data": { "hasMnemonic": true, "network": "POLYGON_AMOY", "walletId": "..." } }`

2. **POST derive-address**
   - **URL:** `POST {{baseUrl}}/api/secrets/derive-address`
   - **Headers:** `Authorization: Bearer <access_token>`, `Content-Type: application/json`
   - **Body:** `{ "network": "POLYGON_AMOY", "asset": "USDT", "label": "deposit-1", "setDefault": true }`
   - **Example response:** `{ "success": true, "address": "0x...", "index": 0, "walletId": "...", "network": "POLYGON_AMOY", "asset": "USDT", "default": true, "isCustodial": true }`

3. **GET list addresses**
   - **URL:** `GET {{baseUrl}}/api/secrets/addresses?network=POLYGON_AMOY&asset=USDT`
   - **Headers:** `Authorization: Bearer <access_token>`
   - **Example response:** `{ "success": true, "data": [ { "address": "0x...", "index": 0, "asset": "USDT", "network": "POLYGON_AMOY", "label": "deposit-1", "isDefault": true, "createdAt": "..." } ], "message": "Addresses list" }`

---

## `/api/address`

All routes require **requireAuth**. Addresses are **derived from mnemonic** (MetaMask-style HD path `m/44'/60'/0'/0/index`), not randomly generated. Import mnemonic first, then derive.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/address/import-mnemonic` | Store encrypted mnemonic (body: `mnemonic` — 12 or 24 words). Call once before deriving. |
| POST | `/api/address/derive` | Derive address from stored mnemonic (body: `network?`, `label?`, `index?`, `storePrivateKey?`). Default network POLYGON_AMOY. |
| POST | `/api/address/generate` | Alias for `/derive`. |
| GET | `/api/address` | List derived addresses (query: `network?`). Excludes encryptedPrivateKey. |
| GET | `/api/address/default` | Get default address (query: `network=POLYGON_AMOY`). |
| PATCH | `/api/address/:id/default` | Set address as default for its network. |
| DELETE | `/api/address/:id` | Delete address (owner only). If was default, next becomes default. |

Requires `WALLET_ENC_KEY` in .env (32+ chars).

---

## `/api/nft`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/nft/info` | No | Mint info (price, supply, active) |
| POST | `/api/nft/mint` | Yes | Mint Wallet NFT. **On-chain:** body `{ txHash }` (user mints in MetaMask; backend verifies). **Backend:** body `{ tokenUri, toAddress? }`. Response includes `mode: "onchain"` or `"backend"`. |

---

## Summary

```
/api
├── auth
│   ├── POST signup
│   ├── POST signin
│   └── POST signout
├── wallet
│   ├── GET  listWallets
│   ├── POST create
│   ├── GET  summary
│   ├── POST add-asset
│   ├── GET  receive-address
│   ├── POST topup
│   ├── POST receive
│   ├── POST send
│   ├── POST swap
│   └── GET  history
├── beneficiary
│   ├── GET    /
│   ├── POST   /
│   ├── PATCH  /:id
│   └── DELETE /:id
├── transactions
│   ├── GET   /
│   ├── GET   /stats
│   ├── GET   /:id
│   └── PATCH /:id/status
├── secrets (mnemonic / HD wallet)
│   ├── GET    readSecrets
│   ├── GET    readDecryptedSecrets
│   ├── PUT    updateSecrets
│   ├── DELETE deleteSecrets
│   ├── POST   read-decrypted   (HD: private key from mnemonic)
│   ├── POST   init-mnemonic
│   ├── POST   derive-address
│   └── GET    addresses
└── nft
    ├── GET  info
    └── POST mint (auth)
```

**Note:** `chainWallletRoutes.js` (chain wallet summary/send) is **not** mounted in `server.js`; only the six route modules above are active.
