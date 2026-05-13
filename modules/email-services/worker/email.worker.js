
// import dotenv from "dotenv";
// import path from "path";
// import { fileURLToPath } from "url";

// const __dirname = path.dirname(fileURLToPath(import.meta.url));
// dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

// import { Worker } from "bullmq";
// import { redisConnection } from "../producer/email.connection.js";
// import { handleEmailJob } from "./email.jobDispatcher.js";
// import { EMAIL_QUEUE_NAME } from "../producer/email.queue.js";
// import connectDb from "../../../database/db.js";

// const startWorker = async () => {
//   try {
//     await connectDb();

//     new Worker(
//       EMAIL_QUEUE_NAME,
//       async (job) => {
//         await handleEmailJob(job);
//       },
//       { connection: redisConnection }
//     );

//     console.log("📨 Email worker started...");
//   } catch (err) {
//     console.error("💥 Worker startup failed:", err);
//     process.exit(1);
//   }
// };

// startWorker();

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import connectDb from "../../../database/db.js";

import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand, } from "@aws-sdk/client-sqs";

import { handleEmailJob } from "./email.jobDispatcher.js";

const sqs = new SQSClient({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const QUEUE_URL = process.env.SQS_EMAIL_QUEUE_URL;

const startWorker = async () => {
  try {
    await connectDb();
    console.log("📨 Email SQS worker started...");

    pollQueue();
  } catch (err) {
    console.error("💥 Worker startup failed:", err);
    process.exit(1);
  }
};

async function pollQueue() {
  while (true) {
    try {
      const response = await sqs.send(
        new ReceiveMessageCommand({
          QueueUrl: QUEUE_URL,
          MaxNumberOfMessages: 5,
          WaitTimeSeconds: 20, // long polling
        })
      );

      if (!response.Messages) continue;

      for (const message of response.Messages) {
        const job = JSON.parse(message.Body);

        console.log("\n📩 Job received:", job.jobName);
        console.log("\n📩 Job received all:", job);

        try {
          await handleEmailJob(job);

          // delete only if success
          await sqs.send(
            new DeleteMessageCommand({
              QueueUrl: QUEUE_URL,
              ReceiptHandle: message.ReceiptHandle,
            })
          );

          console.log("✅ Job completed & deleted");
        } catch (err) {
          console.error("❌ Job failed → will retry via SQS:", err.message);
          // do NOT delete → SQS retries automatically
        }
      }
    } catch (err) {
      console.error("Worker loop error:", err);
    }
  }
}

startWorker();