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

## License

ISC
