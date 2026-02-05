# Project Folder Structure

```
Stable_Wallet_Coin_Backend/
│
├── index.js                          # Main application entry point
├── package.json                      # Dependencies and scripts
├── package-lock.json                 # Lock file for dependencies
├── WALLET_API_TESTING.md             # API testing documentation
├── FOLDER_STRUCTURE.md               # This file
│
├── docs/                             # Documentation folder
│   ├── Stable_Wallet_Coin_Backend.code-workspace
│   └── swagger
│
├── node_modules/                     # Dependencies (auto-generated)
│
└── src/                              # Source code directory
    │
    ├── config/                       # Configuration files
    │   └── swagger.js                # Swagger/OpenAPI configuration
    │
    ├── controllers/                  # Request handlers (business logic)
    │   ├── authController.js         # Authentication controller
    │   ├── beneficiaryController.js  # Beneficiary management
    │   ├── transactionController.JS  # Transaction operations
    │   └── walletController.js       # Wallet operations
    │
    ├── middlewares/                   # Express middlewares
    │   ├── auditLog.js               # Audit logging middleware
    │   ├── auth.js                   # Authentication middleware (requireAuth)
    │   ├── error.js                  # Error handling middleware
    │   ├── requireAuth.js            # Auth requirement middleware
    │   └── validate.middlewares      # Validation middleware
    │
    ├── models/                       # Mongoose database models
    │   ├── auditLog.js               # Audit log model
    │   ├── balance.js                # Balance model
    │   ├── beneficiary.js            # Beneficiary model
    │   ├── transaction.js            # Transaction model
    │   ├── user.js                   # User model
    │   ├── wallet.js                 # Wallet model
    │   └── walletAddressModel.js    # Wallet address model
    │
    ├── routes/                       # API route definitions
    │   ├── authRoute.js              # Authentication routes
    │   ├── beneficiaryRoute.js       # Beneficiary routes
    │   ├── index                     # Route index file
    │   ├── transactiuon.routes       # Transaction routes
    │   └── walletRoutes.js           # Wallet routes
    │
    ├── services/                     # Business logic services
    │   ├── auth.service              # Authentication service
    │   ├── transaction.service       # Transaction service
    │   └── wallet.service            # Wallet service
    │
    └── utils/                        # Utility functions
        ├── apiError                  # API error utilities
        ├── apiResponse               # API response utilities
        ├── constants.js              # Application constants
        ├── logger                    # Logging utilities
        └── money.js                  # Money/currency utilities
```

## Directory Descriptions

### Root Level
- **index.js**: Main Express application setup, middleware configuration, route mounting, and server initialization
- **package.json**: Node.js project configuration with dependencies and scripts
- **WALLET_API_TESTING.md**: Comprehensive guide for testing wallet APIs

### `/src/config`
- **swagger.js**: OpenAPI/Swagger documentation configuration

### `/src/controllers`
Contains request handlers that process business logic:
- **authController.js**: User signup, signin, signout
- **beneficiaryController.js**: CRUD operations for beneficiaries
- **walletController.js**: Wallet operations (summary, topup, send, receive, swap, history, listWallets)
- **transactionController.JS**: Transaction management

### `/src/middlewares`
Express middleware functions:
- **auth.js**: JWT authentication verification (`requireAuth`)
- **auditLog.js**: Audit logging functionality
- **error.js**: Global error handling
- **requireAuth.js**: Authentication requirement wrapper
- **validate.middlewares**: Request validation

### `/src/models`
Mongoose schemas and models:
- **user.js**: User account model
- **wallet.js**: Wallet model
- **balance.js**: Balance tracking per asset
- **transaction.js**: Transaction records
- **beneficiary.js**: Saved beneficiary addresses
- **walletAddressModel.js**: Wallet addresses for different assets/networks
- **auditLog.js**: System audit trail

### `/src/routes`
API route definitions:
- **authRoute.js**: `/api/auth/*` endpoints
- **walletRoutes.js**: `/api/wallet/*` endpoints
- **beneficiaryRoute.js**: `/api/beneficiary/*` endpoints
- **transactiuon.routes**: Transaction-related routes

### `/src/services`
Business logic layer (service pattern):
- **auth.service**: Authentication business logic
- **wallet.service**: Wallet business logic
- **transaction.service**: Transaction business logic

### `/src/utils`
Helper functions and utilities:
- **constants.js**: Application-wide constants (SUPPORTED_ASSETS, SUPPORTED_NETWORKS, etc.)
- **money.js**: Money formatting and validation utilities
- **apiError**: Error handling utilities
- **apiResponse**: Standardized API response utilities
- **logger**: Logging utilities

## API Endpoints Structure

```
/api/auth/
  ├── POST /signup          # User registration
  ├── POST /signin          # User login
  └── POST /signout         # User logout

/api/wallet/
  ├── GET  /listWallets     # List wallets (paginated)
  ├── GET  /summary         # Get wallet summary with balances
  ├── GET  /receive-address # Get receive address
  ├── POST /topup           # Top up wallet
  ├── POST /receive         # Receive funds
  ├── POST /send            # Send funds
  ├── POST /swap            # Swap assets
  └── GET  /history         # Transaction history

/api/beneficiary/
  ├── GET    /              # List beneficiaries
  ├── POST   /              # Create beneficiary
  ├── PATCH  /:id           # Update beneficiary
  └── DELETE /:id           # Delete beneficiary
```

## Key Features

- **Authentication**: JWT-based authentication with device binding
- **Wallet Management**: Multi-asset wallet support (USDT, USDC, DAI)
- **Transactions**: Topup, send, receive, and swap operations
- **Audit Logging**: Comprehensive audit trail
- **API Documentation**: Swagger UI at `/api-docs`
- **Error Handling**: Centralized error handling middleware
- **Validation**: Request validation middleware

