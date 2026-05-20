import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import connectDb from "../../../database/db.js";
import { SQSClient, ReceiveMessageCommand, DeleteMessageCommand, } from "@aws-sdk/client-sqs";
import { handleEmailJob } from "./email.jobDispatcher.js";
import { sqsClient as sqs } from "../config/sqs.client.js"

import EmailTrackingService from "../services/emailTracking.service.js";
import { EMAIL_STATUS } from "../models/emailJob.model.js";
import { EMAIL_EVENT_TYPES } from "../models/emailEvent.model.js";

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

        // ⚠️ IMPORTANT: jobId lives inside payload
        const jobId = job.payload.jobId;

        try {
          // ======================================================
          // 1️⃣ Worker received job from SQS
          // ======================================================
          await EmailTrackingService.markWorkerProcessing(
            jobId,
            message.MessageId
          );

          // ======================================================
          // 2️⃣ Execute actual email sending logic
          // ======================================================
          await handleEmailJob(job);

          // ======================================================
          // 3️⃣ Mark email as successfully sent
          // ======================================================
          await EmailTrackingService.markEmailSent(
            jobId,
            "provider-message-id" // replace later with SES id
          );

          // ======================================================
          // 4️⃣ Delete message from SQS (job completed)
          // ======================================================
          await sqs.send(
            new DeleteMessageCommand({
              QueueUrl: QUEUE_URL,
              ReceiptHandle: message.ReceiptHandle,
            })
          );

          console.log("✅ Job completed & deleted from queue");

        } catch (error) {
          console.error("❌ Worker job failed:", error);

          // ======================================================
          // 5️⃣ Mark retry (DO NOT delete message → SQS will retry)
          // ======================================================
          await EmailTrackingService.markRetry(
            jobId,
            error.message
          );
        }
      }
    } catch (error) {
      console.error("Worker loop error:", error);
    }
  }
}

startWorker();