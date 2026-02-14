# Testing HD address creation

Use either **manual (Postman/curl)** or the **script** below to verify that addresses are being created from the mnemonic.

## Prerequisites

- Backend running (`npm run dev` from backend or root).
- **MASTER_KEY** set in `backend/.env` (min 16 characters).
- A user account (signup then signin to get a JWT).

---

## Option 1: Manual testing (Postman or curl)

### Step 1: Get a JWT

```http
POST http://localhost:3000/api/auth/signin
Content-Type: application/json

{ "email": "your@email.com", "password": "yourpassword" }
```

Copy `accessToken` from the response.

### Step 2: Init mnemonic (create once per user)

```http
POST http://localhost:3000/api/secrets/init-mnemonic
Authorization: Bearer <accessToken>
Content-Type: application/json

{ "network": "POLYGON_AMOY" }
```

**Check:** Response has `data.hasMnemonic: true`, `data.walletId`, `data.network`. No mnemonic in response.

### Step 3: Derive one or more addresses

```http
POST http://localhost:3000/api/secrets/derive-address
Authorization: Bearer <accessToken>
Content-Type: application/json

{ "network": "POLYGON_AMOY", "asset": "USDT", "label": "deposit-1", "setDefault": true }
```

**Check:** Response has `address` (0x...), `index` (0 first time, 1 next, etc.), `walletId`, `network`, `asset`, `default: true`, `isCustodial: true`.

Call again (same or different label) to create a second address; `index` should be 1.

### Step 4: List addresses (verify they were stored)

```http
GET http://localhost:3000/api/secrets/addresses?network=POLYGON_AMOY&asset=USDT
Authorization: Bearer <accessToken>
```

**Check:** Response `data` is an array. Each item has `address`, `index`, `asset`, `network`, `label`, `isDefault`, `createdAt`. Count and indexes should match how many times you called derive-address.

### Optional: Get private key for an address (HDNodeWallet)

```http
POST http://localhost:3000/api/secrets/read-decrypted
Authorization: Bearer <accessToken>
x-confirm: true
Content-Type: application/json

{ "address": "<one of the addresses from step 4>", "reason": "export" }
```

**Check:** Response has `address` and `privateKey`. Key is derived from mnemonic, not stored.

---

## Option 2: Run the test script

From the **backend** directory, with the server already running and a user created:

```bash
cd backend
node scripts/test-hd-addresses.js
```

Or with custom base URL and credentials:

```bash
BASE_URL=http://localhost:3000 EMAIL=your@email.com PASSWORD=yourpassword node scripts/test-hd-addresses.js
```

The script will: signin → init-mnemonic → derive-address twice → GET addresses, and print success/failure so you can confirm addresses are created.
