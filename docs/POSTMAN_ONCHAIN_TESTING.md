# On-Chain Wallet API – Postman / Manual Testing Guide

Use this guide to test **deposit (topup/receive)**, **send**, and **swap** with **txHash verification** on Polygon Amoy.

**Prerequisites**

- Backend running with `AMOY_RPC_URL`, `MOCK_USDT_ADDRESS`, `MOCK_USDC_ADDRESS`, `MOCK_SWAP_ADDRESS` set (from `blockchain/deployments/amoy.json` or `.env`).
- User registered and JWT access token (e.g. from `POST /api/auth/login`).
- MetaMask on Polygon Amoy (chainId 80002), with test MATIC and MockUSDT/MockUSDC (mint via `scripts/mint-mock-tokens.js`).
- User’s wallet address stored in backend (e.g. via `/api/wallet/receive-address` or secrets) so `toAddress`/`fromAddress` belong to the authenticated user.

**Headers for protected endpoints**

```http
Authorization: Bearer <your_access_token>
Content-Type: application/json
```

---

## 1) Deposit / Topup (on-chain)

**Step 1 – Get deposit address**

```http
GET /api/wallet/receive-address?asset=USDT&network=POLYGON
```

**Example response**

```json
{
  "address": "0x...",
  "asset": "USDT",
  "network": "POLYGON_AMOY",
  "tokenAddress": "0x83e4D17029a1a81D5f4bBD1D3ef1c1c91f35022f"
}
```

Use `address` as the recipient in MetaMask (and optionally add `tokenAddress` as custom token).

**Step 2 – Send MockUSDT in MetaMask**

- Network: Polygon Amoy (80002).
- Send MockUSDT from your MetaMask address (A) to the `address` from step 1 (B).
- Note the transaction hash (`txHash`) after the transfer confirms.

**Step 3 – POST topup with txHash**

```http
POST /api/wallet/topup
Content-Type: application/json

{
  "asset": "USDT",
  "network": "POLYGON",
  "amount": 10,
  "toAddress": "0x... (same as receive-address)",
  "txHash": "0x..."
}
```

**Expected response (on-chain mode)**

```json
{
  "balance": { "walletId": "...", "asset": "USDT", "available": 10, "locked": 0 },
  "tx": {
    "type": "TOPUP",
    "status": "COMPLETED",
    "asset": "USDT",
    "amount": 10,
    "txHash": "0x...",
    "chainId": 80002
  },
  "mode": "onchain"
}
```

If you omit `txHash`, the backend performs an **off-chain** topup (ledger credit only) and returns `"mode": "offchain"`.

---

## 2) Receive (on-chain)

Same flow as topup; use **POST /api/wallet/receive** with the same body (include `toAddress` and `txHash` for on-chain).  
Response will have `tx.type === "RECEIVE"` and `"mode": "onchain"`.

**Example request**

```http
POST /api/wallet/receive
Content-Type: application/json

{
  "asset": "USDT",
  "network": "POLYGON",
  "amount": 5,
  "toAddress": "0x...",
  "txHash": "0x..."
}
```

**Example response**

```json
{
  "balance": { "asset": "USDT", "available": 15 },
  "tx": { "type": "RECEIVE", "status": "COMPLETED", "txHash": "0x...", "chainId": 80002 },
  "mode": "onchain"
}
```

---

## 3) Send (on-chain)

**Step 1 – Send MockUSDT in MetaMask**

- From your wallet (A) send MockUSDT to an external address (C).  
- Note the `txHash` after confirmation.

**Step 2 – POST send with txHash**

```http
POST /api/wallet/send
Content-Type: application/json

{
  "asset": "USDT",
  "network": "POLYGON",
  "amount": 10,
  "fromAddress": "0xYourWalletAddress",
  "toAddress": "0xDestinationAddress",
  "fee": 0.1,
  "memo": "Lunch",
  "txHash": "0x..."
}
```

**Expected response (on-chain)**

```json
{
  "balance": { "asset": "USDT", "available": 4.9 },
  "tx": {
    "type": "SEND",
    "status": "COMPLETED",
    "asset": "USDT",
    "amount": 10,
    "fee": 0.1,
    "fromAddress": "0x...",
    "toAddress": "0x...",
    "txHash": "0x...",
    "chainId": 80002
  },
  "mode": "onchain"
}
```

`fromAddress` must belong to the authenticated user (stored in WalletAddress or linked wallet).  
Without `txHash`, the endpoint uses the existing off-chain send and returns `"mode": "offchain"`.

---

## 4) Swap (on-chain)

**Step 1 – Approve MockSwap in MetaMask**

- For the token you’re selling (MockUSDT or MockUSDC), call `approve(MOCK_SWAP_ADDRESS, amountWei)`.

**Step 2 – Execute swap on-chain**

- Call MockSwap’s `swap(tokenIn, tokenOut, amountIn)` from your wallet (e.g. MetaMask).
- `tokenIn` / `tokenOut` are MockUSDT and MockUSDC addresses.
- Note the `txHash` after the transaction confirms.

**Step 3 – POST swap with txHash**

```http
POST /api/wallet/swap
Content-Type: application/json

{
  "fromAsset": "USDT",
  "toAsset": "USDC",
  "network": "POLYGON",
  "amount": 20,
  "rate": 1.0,
  "fee": 0.2,
  "txHash": "0x..."
}
```

Optional: `userAddress` if the backend cannot resolve your wallet address from stored WalletAddress.

**Expected response (on-chain)**

```json
{
  "fromBalance": { "asset": "USDT", "available": 0 },
  "toBalance": { "asset": "USDC", "available": 19.8 },
  "tx": {
    "type": "SWAP",
    "status": "COMPLETED",
    "fromAsset": "USDT",
    "toAsset": "USDC",
    "amount": 20,
    "rate": 0.99,
    "fee": 0.2,
    "txHash": "0x...",
    "chainId": 80002
  },
  "mode": "onchain"
}
```

Without `txHash`, the backend performs a ledger-only swap and returns `"mode": "offchain"`.

---

## 5) NFT mint (on-chain)

**Step 1 – Mint in MetaMask**

- Connect to Polygon Amoy. Call WalletNFT’s `mint(tokenUri)` (user pays mint price in the configured payment token and receives the NFT).
- Ensure the mint recipient address is one that belongs to your account (e.g. stored in WalletAddress / secrets) so the backend can attribute it to you.
- Note the transaction hash after confirmation.

**Step 2 – POST mint with txHash**

```http
POST /api/nft/mint
Authorization: Bearer <token>
Content-Type: application/json

{
  "txHash": "0x..."
}
```

**Expected response (on-chain)**

```json
{
  "success": true,
  "data": { "tokenId": 1, "txHash": "0x...", "to": "0x..." },
  "mode": "onchain"
}
```

If you send `tokenUri` (and optionally `toAddress`) instead of `txHash`, the backend signer mints and returns `"mode": "backend"`.

---

## Error responses

- **401** – Missing or invalid `Authorization: Bearer <token>`.
- **400** – Validation or verification failed (e.g. wrong chain, token, amount, or event mismatch). Body may include `error: "Verification failed"` and details.
- **403** – `toAddress` / `fromAddress` / `userAddress` does not belong to the authenticated user; or NFT mint recipient does not belong to this user.
- **409** – Transaction already processed (duplicate `txHash`).

Use these to build a Postman collection with environment variables for `baseUrl`, `token`, and addresses.
