import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";

import authRoutes from "./src/routes/authRoute.js";
import walletRoutes from "./src/routes/walletRoute.js";

dotenv.config();

const app = express();

// middleware
app.use(cors());
app.use(express.json());

// config
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error(" MONGO_URI is missing. Add it to .env in the project root.");
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

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/wallet", walletRoutes);

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
