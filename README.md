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

## License

ISC
