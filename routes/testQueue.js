import { enqueueEmailJob } from "../queue/connection.js";
import express from "express";

const app = express.Router();

export const testQueue = async (req, res) => {
  await enqueueEmailJob({
    to: "test@example.com",
    subject: "Test Email",
  });

  res.json({ message: "Job queued" });
};


export default app.post("test-queue", testQueue);