import swaggerJsdoc from "swagger-jsdoc";

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Stable Wallet Coin API",
      version: "1.0.0",
      description: "API documentation for Stable Wallet Coin Backend",
      contact: {
        name: "API Support",
      },
    },
    servers: [
      {
        url: process.env.API_URL || "http://localhost:3000",
        description: "Development server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Enter JWT token",
        },
      },
      schemas: {
        User: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "User ID",
            },
            firstName: {
              type: "string",
              description: "First name",
            },
            lastName: {
              type: "string",
              description: "Last name",
            },
            email: {
              type: "string",
              format: "email",
              description: "Email address",
            },
            phone: {
              type: "string",
              description: "Phone number",
            },
            kycStatus: {
              type: "string",
              enum: ["PENDING", "VERIFIED", "REJECTED"],
              description: "KYC verification status",
            },
            role: {
              type: "string",
              enum: ["USER", "ADMIN"],
              description: "User role",
            },
            isActive: {
              type: "boolean",
              description: "Account active status",
            },
          },
        },
        AuthResponse: {
          type: "object",
          properties: {
            message: {
              type: "string",
            },
            accessToken: {
              type: "string",
              description: "JWT access token",
            },
            refreshToken: {
              type: "string",
              description: "JWT refresh token",
            },
            user: {
              $ref: "#/components/schemas/User",
            },
          },
        },
        Balance: {
          type: "object",
          properties: {
            asset: {
              type: "string",
              description: "Asset code (e.g., USDT, USDC)",
            },
            amount: {
              type: "number",
              description: "Balance amount",
            },
          },
        },
        WalletSummary: {
          type: "object",
          properties: {
            walletId: {
              type: "string",
              description: "Wallet ID",
            },
            balances: {
              type: "array",
              items: {
                $ref: "#/components/schemas/Balance",
              },
            },
          },
        },
        Transaction: {
          type: "object",
          properties: {
            _id: {
              type: "string",
            },
            type: {
              type: "string",
              enum: ["TOPUP", "SEND", "RECEIVE", "SWAP"],
            },
            status: {
              type: "string",
              enum: ["PENDING", "COMPLETED", "FAILED"],
            },
            asset: {
              type: "string",
            },
            network: {
              type: "string",
            },
            amount: {
              type: "number",
            },
            fromAddress: {
              type: "string",
              nullable: true,
            },
            toAddress: {
              type: "string",
              nullable: true,
            },
            memo: {
              type: "string",
              nullable: true,
            },
            createdAt: {
              type: "string",
              format: "date-time",
            },
          },
        },
        Error: {
          type: "object",
          properties: {
            message: {
              type: "string",
              description: "Error message",
            },
          },
        },
      },
    },
    tags: [
      {
        name: "Authentication",
        description: "User authentication endpoints",
      },
      {
        name: "Wallet",
        description: "Wallet management endpoints",
      },
      {
        name: "Beneficiary",
        description: "Beneficiary management endpoints",
      },
    ],
  },
  apis: ["./src/routes/*.js"], // Path to the API routes
};

export const swaggerSpec = swaggerJsdoc(options);

