import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import redoc from "redoc-express";

import authRoutes from "./src/routes/authRoute.js";
import walletRoutes from "./src/routes/walletRoutes.js";
import beneficiaryRoutes from "./src/routes/beneficiaryRoute.js";
import transactionRoutes from "./src/routes/transactionRoutes.js";
import secretsRoutes from "./src/routes/secretsRoutes.js";
import nftRoutes from "./src/routes/nftRoutes.js";
import addressRoutes from "./src/routes/addressRoute.js";
import { swaggerSpec } from "./src/config/swagger.js";
import { errorHandler } from "./src/middlewares/errorHandler.js";

dotenv.config();

const app = express();

// middleware
app.use(cors());
app.use(express.json());

// config
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error(" MONGO_URI is missing. Add it to backend/.env.");
  process.exit(1);
}

//  DB connect
mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log(" MongoDB connected");
    // Log connected contracts (after MongoDB is up)
    import("./src/config/loadDeployment.js")
      .then(({ loadDeployment }) => loadDeployment())
      .then((deployment) => {
        const c = deployment.contracts || {};
        const names = Object.entries(c)
          .filter(([, addr]) => addr)
          .map(([name, addr]) => `  ${name}: ${addr}`);
        console.log(" Contracts connected (" + deployment.network + ", chainId " + deployment.chainId + "):");
        if (names.length) names.forEach((line) => console.log(line));
        else console.log("  (none)");
      })
      .catch((e) => console.warn(" Contracts not loaded (set CHAIN_ID + DEPLOYMENTS_PATH if using chain):", e?.message));
  })
  .catch((err) => {
    console.error(" MongoDB connection error:", err.message);
    process.exit(1);
  });

mongoose.connection.on("disconnected", () => {
  console.warn("⚠️ MongoDB disconnected");
});

// Optional: start deposit watcher (credits DB when users deposit to Vault). Set ENABLE_DEPOSIT_WATCHER=1 to enable.
if (process.env.ENABLE_DEPOSIT_WATCHER === "1") {
  import("./src/workers/depositProcessor.js").then(({ runDepositProcessor }) => {
    runDepositProcessor();
    console.log(" Deposit watcher started");
  }).catch((e) => console.warn(" Deposit watcher not started:", e?.message));
}

// Health check
app.get("/", (req, res) => res.json({ status: "Stablecoin API running " }));

// API index – list available API bases (so "APIs on localhost" are visible)
app.get("/api", (req, res) => {
  const base = `${req.protocol}://${req.get("host") || `localhost:${process.env.PORT || 3000}`}`;
  res.json({
    message: "Stable Wallet Coin API",
    baseUrl: `${base}/api`,
    endpoints: {
      auth: `${base}/api/auth`,
      wallet: `${base}/api/wallet`,
      beneficiary: `${base}/api/beneficiary`,
      transactions: `${base}/api/transactions`,
      secrets: `${base}/api/secrets`,
      nft: `${base}/api/nft`,
      address: `${base}/api/address`,
    },
    docs: { swagger: `${base}/api-docs`, redoc: `${base}/api-docs-redoc`, openapi: `${base}/openapi.json` },
  });
});

// OpenAPI JSON endpoint (needed by Swagger UI)
app.get("/openapi.json", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.json(swaggerSpec);
});

// Swagger UI - dynamically set server URL for Render/production
app.use("/api-docs", swaggerUi.serve);
app.get("/api-docs", (req, res, next) => {
  // Update server URL based on request (handles Render/proxy environments)
  const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
  const host = req.headers["x-forwarded-host"] || req.get("host") || `localhost:${PORT}`;
  const serverUrl = `${protocol}://${host}`;

  const updatedSpec = {
    ...swaggerSpec,
    servers: [
      {
        url: serverUrl,
        description: "Current server",
      },
    ],
  };

  return swaggerUi.setup(updatedSpec, {
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "Stable Wallet Coin API Documentation",
    swaggerOptions: {
      persistAuthorization: true,
      validatorUrl: null, // Disable external validator to avoid CORS issues
    },
  })(req, res, next);
});

// ReDoc - Alternative API documentation
app.get("/api-docs-redoc", redoc({
  title: "Stable Wallet Coin API Documentation",
  specUrl: "/openapi.json",
  nonce: "",
  redocOptions: {
    theme: {
      colors: {
        primary: {
          main: "#32329f",
        },
      },
    },
  },
}));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/wallet", walletRoutes);
app.use("/api/beneficiary", beneficiaryRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/secrets", secretsRoutes);
app.use("/api/nft", nftRoutes);
app.use("/api/address", addressRoutes);

// 404
app.use((req, res) => {
  res.status(404).json({ message: "Route not found", path: req.originalUrl });
});

// Central error handler (ApiError + logger)
app.use(errorHandler);

app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
