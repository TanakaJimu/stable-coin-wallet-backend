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
import { swaggerSpec } from "./src/config/swagger.js";

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
  .then(() => console.log(" MongoDB connected"))
  .catch((err) => {
    console.error(" MongoDB connection error:", err.message);
    process.exit(1);
  });

mongoose.connection.on("disconnected", () => {
  console.warn("⚠️ MongoDB disconnected");
});

// Health check
app.get("/", (req, res) => res.json({ status: "Stablecoin API running " }));

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

// 404
app.use((req, res) => {
  res.status(404).json({ message: "Route not found", path: req.originalUrl });
});

// error handler
app.use((err, req, res, next) => {
  console.error(" Unhandled error:", err);
  res.status(500).json({ message: "Server error" });
});

app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
