# Stable Wallet Coin – On-Chain Backend

Run backend and blockchain locally, deploy to testnet, and test flows.

## Prerequisites

- Node.js 18+
- MongoDB
- Hardhat (in `blockchain/`)

## Commands

### 1. Install

```bash
# From repo root
npm run install:all
# or
cd backend && npm install
cd ../blockchain && npm install
```

### 2. Blockchain: compile and deploy

```bash
cd blockchain
npm run compile
# Deploy to Amoy (Polygon)
npm run deploy:amoy
# Or deploy on-chain set (StableToken, Vault, NFTPass)
npx hardhat run scripts/deploy-onchain.js --network amoy
# Other networks
npx hardhat run scripts/deploy-onchain.js --network mumbai
npx hardhat run scripts/deploy-onchain.js --network goerli
```

Deployment writes `blockchain/deployments/<network>.json`. Backend reads this via `DEPLOYMENTS_PATH` and `CHAIN_ID`.

### 3. Backend env

Copy and edit:

```bash
cp backend/.env.example backend/.env
# Set MONGO_URI, JWT_SECRET, CHAIN_ID, BLOCKCHAIN_RPC_URL, BACKEND_SIGNER_PRIVATE_KEY (or OPERATOR_PRIVATE_KEY)
```

- `CHAIN_ID`: e.g. `80002` (Amoy), `80001` (Mumbai), `5` (Goerli).
- `DEPLOYMENTS_PATH`: e.g. `../blockchain/deployments` when running from `backend/`.
- Operator key: same key that has OPERATOR_ROLE / MINTER_ROLE on contracts (e.g. deployer).

### 4. Run backend

```bash
cd backend
npm run dev
# or
node server.js
```

Optional: start deposit watcher (credits DB when users deposit to Vault). In `server.js` you can add:

```js
import { runDepositProcessor } from "./src/workers/depositProcessor.js";
runDepositProcessor();
```

### 5. Run contract tests

```bash
cd blockchain
npm test
```

### 6. Test backend ↔ chain

```bash
cd backend
node scripts/testChain.js
```

## Flows

- **Receive address (custodial):** `GET /api/wallet/receive-address?asset=USDT&network=ERC20` returns Vault address and `depositReference` (`w_<walletId>`). User must call `token.approve(vault, amount)` then `vault.deposit(token, amount, depositReference)`. Watcher will credit the wallet after confirmations.
- **Top-up:** `POST /api/wallet/topup` credits the ledger (and optionally mints on-chain if you wire it).
- **Send:** `POST /api/wallet/send` debits ledger and, if Vault is configured, calls `Vault.withdrawTo(token, toAddress, amount, ref)`.
- **Swap:** Ledger swap is implemented; for on-chain swap use `Vault.swap(...)` via backend operator (see `swapService.js`).
- **NFT:** `POST /api/nft/mint` mints NFTPass (or WalletNFT) to user; requires MINTER_ROLE.

## Security (production)

- Do not keep operator private key in plain `.env`; use KMS/HSM or env vault.
- Use multisig + timelock for DEFAULT_ADMIN_ROLE.
- Rate-limit withdrawal endpoints; consider KYC/OTP for large withdrawals.
- See `docs/MIGRATION_PRODUCTION.md` for key management and monitoring.
