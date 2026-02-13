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

All routes require **requireAuth**.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/secrets/createSecrets` | **Generate** a new custodial address (server creates address + encrypted key). Body optional: `walletId?`, `network?`, `asset?`, `label?`, `setDefault?`. Do not send userAddress/privateKey. |
| GET | `/api/secrets/readSecrets` | Read secrets (address only) |
| GET | `/api/secrets/readDecryptedSecrets` | Read decrypted secrets (sensitive) |
| PUT | `/api/secrets/updateSecrets` | Update secrets |
| DELETE | `/api/secrets/deleteSecrets` | Delete secrets |
| POST | `/api/secrets/generate` | **Custodial:** generate new address (ethers), store encrypted key; body `walletId?`, `network?`, `asset?`, `label?`, `setDefault?` |
| GET | `/api/secrets` | **Custodial:** list addresses (no private key) |
| GET | `/api/secrets/:id` | **Custodial:** get one secret metadata |
| POST | `/api/secrets/read-decrypted` | **Custodial:** return private key (requires `x-confirm: true` + body `secretId`; rate limited) |
| DELETE | `/api/secrets/:id` | **Custodial:** soft-delete secret |

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
├── secrets
│   ├── POST   createSecrets
│   ├── GET    readSecrets
│   ├── GET    readDecryptedSecrets
│   ├── PUT    updateSecrets
│   └── DELETE deleteSecrets
└── nft
    ├── GET  info
    └── POST mint (auth)
```

**Note:** `chainWallletRoutes.js` (chain wallet summary/send) is **not** mounted in `server.js`; only the six route modules above are active.
