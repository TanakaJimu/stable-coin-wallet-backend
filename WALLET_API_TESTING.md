# Wallet API Testing Guide

## Prerequisites

1. **Get Authentication Token**: First, you need to sign up/sign in to get an access token
2. **Base URL**: 
   - Local: `http://localhost:3000`
   - Render: `https://your-render-app.onrender.com`

## Step 1: Get Authentication Token

### Sign Up (if new user)
```bash
POST /api/auth/signup
Content-Type: application/json

{
  "firstName": "John",
  "lastName": "Doe",
  "idNumber": "1234567890",
  "email": "john.doe@example.com",
  "phone": "+1234567890",
  "password": "SecurePassword123!",
  "deviceId": "device-uuid-1234"
}
```

### Sign In (if existing user)
```bash
POST /api/auth/signin
Content-Type: application/json

{
  "emailOrPhone": "john.doe@example.com",
  "password": "SecurePassword123!",
  "deviceId": "device-uuid-1234"
}
```

**Response will include:**
```json
{
  "message": "Signin successful",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "...",
  "user": { ... }
}
```

**Save the `accessToken` - you'll need it for all wallet API calls!**

---

## Step 2: Test Wallet APIs

All wallet endpoints require authentication. Include the token in the `Authorization` header:
```
Authorization: Bearer <your-access-token>
```

### 1. Get Wallet Summary
Get all balances for your wallet.

**Request:**
```bash
GET /api/wallet/summary
Authorization: Bearer <your-access-token>
```

**Response:**
```json
{
  "walletId": "507f1f77bcf86cd799439011",
  "balances": [
    {
      "asset": "USDT",
      "amount": 1000.50
    },
    {
      "asset": "USDC",
      "amount": 500.00
    }
  ]
}
```

---

### 2. Get Receive Address
Get or generate a receive address for a specific asset and network.

**Request:**
```bash
GET /api/wallet/receive-address?asset=USDT&network=TRC20
Authorization: Bearer <your-access-token>
```

**Query Parameters:**
- `asset` (optional): USDT or USDC (default: USDT)
- `network` (optional): TRC20 or ERC20 (default: TRC20)

**Response:**
```json
{
  "_id": "...",
  "walletId": "507f1f77bcf86cd799439011",
  "asset": "USDT",
  "network": "TRC20",
  "address": "demo_USDT_TRC20_439011",
  "isDefault": true
}
```

---

### 3. Top Up Wallet
Add funds to your wallet (for testing/demo purposes).

**Request:**
```bash
POST /api/wallet/topup
Authorization: Bearer <your-access-token>
Content-Type: application/json

{
  "asset": "USDT",
  "amount": 100.50,
  "network": "TRC20",
  "reference": "tx_ref_12345"
}
```

**Request Body:**
- `asset` (required): USDT or USDC
- `amount` (required): Amount to add (minimum 0.01)
- `network` (optional): TRC20 or ERC20 (default: TRC20)
- `reference` (optional): Transaction reference

**Response:**
```json
{
  "balance": {
    "asset": "USDT",
    "amount": 1101.00
  },
  "tx": {
    "_id": "...",
    "type": "TOPUP",
    "status": "COMPLETED",
    "amount": 100.50,
    ...
  }
}
```

---

### 4. Receive Funds
Manually credit funds to wallet (simulates receiving from external source).

**Request:**
```bash
POST /api/wallet/receive
Authorization: Bearer <your-access-token>
Content-Type: application/json

{
  "asset": "USDT",
  "amount": 50.00,
  "network": "TRC20",
  "fromAddress": "TXYZ1234567890abcdef",
  "memo": "Payment for services",
  "reference": "tx_ref_67890"
}
```

**Request Body:**
- `asset` (required): USDT or USDC
- `amount` (required): Amount to receive
- `network` (optional): TRC20 or ERC20 (default: TRC20)
- `fromAddress` (optional): Sender's address
- `memo` (optional): Transaction memo
- `reference` (optional): Transaction reference

---

### 5. Send Funds
Send funds to another address.

**Request:**
```bash
POST /api/wallet/send
Authorization: Bearer <your-access-token>
Content-Type: application/json

{
  "asset": "USDT",
  "amount": 25.00,
  "network": "TRC20",
  "toAddress": "TXYZ9876543210fedcba",
  "memo": "Payment for goods",
  "fee": 1.00
}
```

**Request Body:**
- `asset` (required): USDT or USDC
- `amount` (required): Amount to send (minimum 0.01)
- `network` (optional): TRC20 or ERC20 (default: TRC20)
- `toAddress` (required): Recipient's address
- `memo` (optional): Transaction memo
- `fee` (optional): Transaction fee (default: 0)

**Note:** Make sure you have sufficient balance (amount + fee)

---

### 6. Swap Assets
Swap one asset for another (e.g., USDT to USDC).

**Request:**
```bash
POST /api/wallet/swap
Authorization: Bearer <your-access-token>
Content-Type: application/json

{
  "fromAsset": "USDT",
  "toAsset": "USDC",
  "amount": 100.00,
  "rate": 1.0,
  "fee": 0.50
}
```

**Request Body:**
- `fromAsset` (required): USDT or USDC
- `toAsset` (required): USDT or USDC (must be different)
- `amount` (required): Amount to swap
- `rate` (optional): Exchange rate (default: 1.0)
- `fee` (optional): Swap fee (default: 0)

**Response:**
```json
{
  "fromBalance": {
    "asset": "USDT",
    "amount": 900.00
  },
  "toBalance": {
    "asset": "USDC",
    "amount": 600.00
  },
  "tx": { ... },
  "credited": 100.00
}
```

---

### 7. Get Transaction History
Get your wallet's transaction history.

**Request:**
```bash
GET /api/wallet/history?limit=30
Authorization: Bearer <your-access-token>
```

**Query Parameters:**
- `limit` (optional): Number of transactions (default: 30, max: 100)

**Response:**
```json
[
  {
    "_id": "...",
    "type": "SEND",
    "status": "COMPLETED",
    "asset": "USDT",
    "amount": 25.00,
    "toAddress": "TXYZ9876543210fedcba",
    "createdAt": "2024-01-15T10:30:00.000Z"
  },
  {
    "_id": "...",
    "type": "TOPUP",
    "status": "COMPLETED",
    "asset": "USDT",
    "amount": 100.50,
    "createdAt": "2024-01-15T09:00:00.000Z"
  }
]
```

---

## Testing Methods

### Method 1: Using Swagger UI (Recommended)

1. Start your server: `npm start` or `npm run dev`
2. Open browser: `http://localhost:3000/api-docs` (or your Render URL)
3. Click **"Authorize"** button (top right)
4. Enter your token: `Bearer <your-access-token>` or just `<your-access-token>`
5. Click **"Authorize"** then **"Close"**
6. Now you can test all endpoints directly from Swagger UI!

### Method 2: Using Postman

1. Create a new collection: "Wallet API"
2. Set collection variable: `base_url` = `http://localhost:3000`
3. Set collection variable: `token` = `<your-access-token>`
4. For each request:
   - Set Authorization type: **Bearer Token**
   - Token: `{{token}}`
   - URL: `{{base_url}}/api/wallet/<endpoint>`

### Method 3: Using cURL

```bash
# Get Summary
curl -X GET "http://localhost:3000/api/wallet/summary" \
  -H "Authorization: Bearer <your-access-token>"

# Top Up
curl -X POST "http://localhost:3000/api/wallet/topup" \
  -H "Authorization: Bearer <your-access-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "asset": "USDT",
    "amount": 100.50,
    "network": "TRC20"
  }'

# Send Funds
curl -X POST "http://localhost:3000/api/wallet/send" \
  -H "Authorization: Bearer <your-access-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "asset": "USDT",
    "amount": 25.00,
    "toAddress": "TXYZ9876543210fedcba",
    "network": "TRC20"
  }'
```

### Method 4: Using JavaScript/Node.js

```javascript
const baseUrl = 'http://localhost:3000';
const token = 'your-access-token-here';

// Get Summary
const summary = await fetch(`${baseUrl}/api/wallet/summary`, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

// Top Up
const topup = await fetch(`${baseUrl}/api/wallet/topup`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    asset: 'USDT',
    amount: 100.50,
    network: 'TRC20'
  })
});
```

---

## Common Errors

### 401 Unauthorized
- **Cause**: Missing or invalid token
- **Solution**: Get a new token from `/api/auth/signin`

### 400 Bad Request
- **Cause**: Missing required fields, invalid amount, or insufficient balance
- **Solution**: Check request body and ensure sufficient balance

### 403 Forbidden
- **Cause**: Account disabled or unrecognized device
- **Solution**: Check user status and device ID

---

## Testing Workflow Example

1. **Sign Up/Sign In** → Get `accessToken`
2. **Get Summary** → Check initial balances (should be empty)
3. **Top Up** → Add test funds (e.g., 1000 USDT)
4. **Get Receive Address** → Get your wallet address
5. **Send** → Send funds to another address
6. **Swap** → Convert USDT to USDC
7. **Get History** → View all transactions
8. **Get Summary** → Verify final balances

---

## Quick Test Script

Save this as `test-wallet.sh`:

```bash
#!/bin/bash

BASE_URL="http://localhost:3000"
EMAIL="test@example.com"
PASSWORD="TestPassword123!"
DEVICE_ID="test-device-123"

# Sign in
echo "Signing in..."
RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/signin" \
  -H "Content-Type: application/json" \
  -d "{\"emailOrPhone\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"deviceId\":\"$DEVICE_ID\"}")

TOKEN=$(echo $RESPONSE | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo "Failed to get token. Creating account..."
  # Sign up if sign in fails
  RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/signup" \
    -H "Content-Type: application/json" \
    -d "{\"firstName\":\"Test\",\"lastName\":\"User\",\"idNumber\":\"123456\",\"email\":\"$EMAIL\",\"phone\":\"+1234567890\",\"password\":\"$PASSWORD\",\"deviceId\":\"$DEVICE_ID\"}")
  TOKEN=$(echo $RESPONSE | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
fi

echo "Token: $TOKEN"
echo ""

# Get Summary
echo "Getting wallet summary..."
curl -X GET "$BASE_URL/api/wallet/summary" \
  -H "Authorization: Bearer $TOKEN" | jq

# Top Up
echo "Topping up wallet..."
curl -X POST "$BASE_URL/api/wallet/topup" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"asset":"USDT","amount":1000,"network":"TRC20"}' | jq
```

Make it executable: `chmod +x test-wallet.sh`
Run it: `./test-wallet.sh`

