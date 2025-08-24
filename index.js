import express from "express";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import contractRoutes from "./routes/contractRoutes.js";
import cookieParser from "cookie-parser";
import cors from "cors";
import disputeRoutes from "./routes/disputeRoutes.js";
dotenv.config();

const app = express();
app.use(express.json());
app.use(cookieParser());

// ✅ CORS config
app.use(
  cors({
    origin: "http://localhost:8080", // match your frontend URL exactly
    credentials: true, // allow cookies
  })
);

connectDB();

app.use("/api/auth", authRoutes);
app.use("/api/contract", contractRoutes);
app.use("/api", disputeRoutes);



const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
