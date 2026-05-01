
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import { Worker } from "bullmq";
import { redisConnection } from "../producer/email.connection.js";
import { handleEmailJob } from "./email.jobDispatcher.js";
import { EMAIL_QUEUE_NAME } from "../producer/email.queue.js";
import connectDb from "../../../database/db.js";

const startWorker = async () => {
  try {
    await connectDb();

    new Worker(
      EMAIL_QUEUE_NAME,
      async (job) => {
        await handleEmailJob(job);
      },
      { connection: redisConnection }
    );

    console.log("📨 Email worker started...");
  } catch (err) {
    console.error("💥 Worker startup failed:", err);
    process.exit(1);
  }
};

startWorker();