import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import "./modules/payments-v2/queue/webhook.worker.js";

mongoose
  .connect(process.env.MONGO_URL)
  .then(() => {
    console.log("✅ Webhook worker connected to MongoDB");
  })
  .catch((err) => {
    console.error("❌ Worker Mongo connection failed:", err);
  });