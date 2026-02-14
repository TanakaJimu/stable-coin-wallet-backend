# Stable Wallet Coin

Backend API + blockchain (Hardhat) for the Stable Wallet Coin system.

## Layout (reference structure)

```
Stable_Wallet_Coin_Backend/
├── backend/                 # API server
│   ├── server.js
│   ├── src/
│   └── package.json
├── blockchain/              # Hardhat project
│   ├── contracts/
│   │   ├── StableCoinWallet.sol   # ERC20
│   │   └── WalletNFT.sol          # ERC721 (paid with stablecoin)
│   ├── scripts/
│   │   └── deploy.js
│   ├── test/
│   ├── hardhat.config.js
│   ├── package.json
│   └── .env
├── package.json             # Root scripts (start, dev, deploy, etc.)
└── README.md
```

## Prerequisites

- Node.js (v18+)
- MongoDB (for backend)
- RPC URL and private key for blockchain (e.g. Polygon Amoy)

## Installation

1. **Install all dependencies:**
   ```bash
   npm run install:all
   ```
   Or separately:
   ```bash
   npm run backend:install
   npm run blockchain:install
   ```

2. **Environment:**
   - **Backend:** Copy `backend/.env.example` to `backend/.env`. Set `MONGO_URI`, `PORT`, JWT secrets, etc.
   - **Blockchain:** Copy `blockchain/.env.example` to `blockchain/.env`. Set `BLOCKCHAIN_RPC_URL` and `PRIVATE_KEY`. After deploy, addresses are written to `blockchain/.env` and `blockchain/deployments/amoy.json`.

   To let the backend read deployment addresses, set in `backend/.env`:
   ```env
   DEPLOYMENTS_PATH=../blockchain/deployments
   CHAIN_ID=80002
   AMOY_RPC_URL=https://rpc-amoy.polygon.technology
   MOCK_USDT_ADDRESS=0x...   # from blockchain/deployments/amoy.json
   MOCK_USDC_ADDRESS=0x...
   MOCK_SWAP_ADDRESS=0x...   # MockSwap contract for USDT↔USDC
   ```

   For **custodial address generation** (server-generated MetaMask-style addresses), add:
   ```env
   MASTER_KEY=your-master-key-min-16-chars   # Production: use KMS (AWS/GCP/HashiCorp Vault)
   ```

## Running the backend

From project root:

```bash
npm start
```

Or with auto-reload:

```bash
npm run dev
```

Server runs on `http://localhost:3000` (or `PORT` from `backend/.env`).

- Swagger: `http://localhost:3000/api-docs`
- ReDoc: `http://localhost:3000/api-docs-redoc`

## Blockchain (Hardhat)

From project root:

- **Compile:**
  ```bash
  npm run compile
  ```
- **Deploy to Amoy:**
  ```bash
  npm run deploy:amoy
  ```
- **Run tests:**
  ```bash
  npm run test:blockchain
  ```

Or run from `blockchain/`:

```bash
cd blockchain
npm run compile
npm run deploy:amoy
npm test
```

### Contracts

- **StableCoinWallet (ERC20)** – Stablecoin; owner can mint. Used as payment for WalletNFT mints.
- **WalletNFT (ERC721)** – NFT mintable by paying with StableCoinWallet; price and active flag set by owner.

Deploy script writes `blockchain/deployments/amoy.json` and updates `blockchain/.env` with `STABLE_COIN_WALLET_ADDRESS` and `WALLET_NFT_ADDRESS`.

## Custodial addresses (MetaMask-style)

The API can **generate** Ethereum-style addresses (ethers `Wallet.createRandom()`), store the private key **encrypted** (AES-256-GCM with `MASTER_KEY`), and link them to a user/wallet.

- **POST /api/secrets/generate** — Generate a new address (body: `walletId?`, `network?`, `asset?`, `label?`, `setDefault?`). Returns `secretId`, `address`.
- **GET /api/secrets** — List your custodial addresses (no private key).
- **GET /api/secrets/:id** — Get one address metadata.
- **POST /api/secrets/read-decrypted** — Return private key only with **x-confirm: true** header and body `{ secretId, reason? }`. Rate limited; fully audited.
- **DELETE /api/secrets/:id** — Soft-delete a secret.

### Import private key into MetaMask (dev)

1. Call **POST /api/secrets/generate** (with `Authorization: Bearer <token>`), then **POST /api/secrets/read-decrypted** with `x-confirm: true` and `{ "secretId": "<id>" }`.
2. In MetaMask: **Profile → Import account → Paste private key** (from the response) → Done.
3. Add Polygon Amoy (chainId 80002) and the MockUSDT contract address (from `MOCK_USDT_ADDRESS` or deployments) as a custom token.

### On-chain testing checklist

1. Deploy MockUSDT (and MockUSDC/MockSwap) to Polygon Amoy; set addresses in `backend/.env` or `tokenRegistry`.
2. Mint mock tokens to the generated address (e.g. `blockchain/scripts/mint-mock-tokens.js` with `RECIPIENT=<generated address>`).
3. Get deposit address: **GET /api/wallet/receive-address?asset=USDT&network=POLYGON** (use the custodial address as the user’s receive address).
4. From MetaMask (with the generated address), send MockUSDT to that receive address; then **POST /api/wallet/topup** with `txHash`, `amount`, `toAddress` to verify on-chain deposit.

## Address API (`/api/address`) — MetaMask-style derivation

Addresses are **derived from your mnemonic** (like MetaMask), not randomly generated. You import a 12 or 24 word phrase once; the backend derives addresses at path `m/44'/60'/0'/0/index`.

All routes require `Authorization: Bearer <token>`.

### Security & operational notes

- **WALLET_ENC_KEY:** Set in `.env` (32+ characters). Used to encrypt the mnemonic and optional derived keys. Never commit this key.
- **Never log or return** mnemonics or private keys. Responses never include them.
- **Production:** Use HSM or KMS for key custody; rate-limit and strengthen auth.

### Flow

1. **Import mnemonic** (once): `POST /api/address/import-mnemonic` with your BIP-39 phrase (12 or 24 words). Stored encrypted.
2. **Derive addresses**: `POST /api/address/derive` (or `/generate`) to derive the next address, or pass `index` (0, 1, 2...) for a specific account index. Optionally set `storePrivateKey: true` to store the derived key encrypted (custodial).
3. **List / default / set default / delete** as below.

### Postman / curl examples

**1. Import mnemonic (do this first):**

```bash
curl -X POST "http://localhost:3000/api/address/import-mnemonic" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"mnemonic":"word1 word2 word3 ... twelve or twenty four words"}'
```

Expected response (201): `{ "success": true, "message": "Mnemonic stored securely. You can now derive addresses." }`

**2. Derive address (retrieve like MetaMask):**

```bash
curl -X POST "http://localhost:3000/api/address/derive" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"network":"POLYGON_AMOY","label":"Account 0","storePrivateKey":false}'
```

Optional body: `index` (0, 1, 2...). If omitted, next index is used. Response (201):

```json
{
  "id": "...",
  "address": "0x...",
  "network": "POLYGON_AMOY",
  "derivationIndex": 0,
  "label": "Account 0",
  "isDefault": true,
  "createdAt": "..."
}
```

**3. List addresses:**

```bash
curl -H "Authorization: Bearer <token>" "http://localhost:3000/api/address?network=POLYGON_AMOY"
```

**4. Get default address:**

```bash
curl -H "Authorization: Bearer <token>" "http://localhost:3000/api/address/default?network=POLYGON_AMOY"
```

**5. Set default:** `PATCH /api/address/:id/default`  
**6. Delete address:** `DELETE /api/address/:id`

### Env for address API

In `backend/.env`:

```env
WALLET_ENC_KEY=your-32-character-secret-key-minimum!!
```

## License

ISC
