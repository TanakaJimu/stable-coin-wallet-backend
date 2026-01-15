import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import authRoutes from "./src/routes/authRoute.js";


dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const MONGO_URI = "mongodb+srv://tjimu63_db_user:Jk8NC5x1VPM4VKdN@cluster0.yuc04rc.mongodb.net/Stable_Coin_Db?appName=Cluster0";

if (!MONGO_URI) {
  console.error("❌ MONGO_URI is missing. Add it to .env in the project root.");
  process.exit(1);
}

mongoose
  .connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
    process.exit(1);
  });

mongoose.connection.on("disconnected", () => {
  console.warn("⚠️ MongoDB disconnected");
});

// ROUTES IMPORT


app.use("/api/auth", authRoutes);


app.get("/", (req, res) => res.json({ status: "Stablecoin API running ✅" }));

app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
