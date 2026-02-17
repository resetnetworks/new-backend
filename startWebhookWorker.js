import mongoose from "mongoose";
import "./modules/payments-v2/queue/webhook.worker.js";

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("Webhook worker connected to MongoDB");
  })
  .catch(console.error);
