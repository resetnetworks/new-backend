import { Worker } from "bullmq";
import { redisConnection } from "../queue/connection.js";

const worker = new Worker(
  "emailQueue",
  async (job) => {
    console.log("📩 Processing job:", job.name);

    switch (job.name) {
      case "send_email":
        console.log("Sending email to:", job.data.to);
        break;

      default:
        console.warn("Unknown job:", job.name);
    }
  },
  {
    connection: redisConnection,
    concurrency: 5, // parallel jobs
  }
);

// Logging (VERY IMPORTANT for debugging)
worker.on("completed", (job) => {
  console.log(`✅ Job completed: ${job.id}`);
});

worker.on("failed", (job, err) => {
  console.error(`❌ Job failed: ${job?.id}`, err);
});

worker.on("error", (err) => {
  console.error("Worker error:", err);
});