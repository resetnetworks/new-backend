import "dotenv/config";
import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  ChangeMessageVisibilityCommand,
} from "@aws-sdk/client-sqs";

const sqs = new SQSClient({ region: "ap-south-1" });

const QUEUE_URL = process.env.SQS_EMAIL_QUEUE_URL;

// exponential retry delays (seconds)
const RETRY_DELAYS = [60, 120, 240, 480, 960]; // 1m,2m,4m,8m,16m

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

async function processEmailJob(message) {
  const body = JSON.parse(message.Body);

  console.log("Processing message:", body);

  // 👇 INTENTIONALLY FAIL UNKNOWN EVENTS
  if (body.type !== "WELCOME") {
    throw new Error("Unknown email type → forced failure");
  }

  // Normally SES email sending would happen here
  console.log("Email sent successfully 🎉");
}

async function handleFailure(message, error) {
  const receiveCount = Number(
    message.Attributes.ApproximateReceiveCount
  );

  console.log(`❌ Attempt ${receiveCount} failed`);

  // If still retries left → apply exponential delay
  if (receiveCount <= RETRY_DELAYS.length) {
    const delay = RETRY_DELAYS[receiveCount - 1];

    console.log(`⏳ Retrying in ${delay} seconds`);

    const cmd = new ChangeMessageVisibilityCommand({
      QueueUrl: QUEUE_URL,
      ReceiptHandle: message.ReceiptHandle,
      VisibilityTimeout: delay,
    });

    await sqs.send(cmd);
  }
}

async function pollQueue() {
  while (true) {
    try {
      const command = new ReceiveMessageCommand({
        QueueUrl: QUEUE_URL,
        MaxNumberOfMessages: 1,
        WaitTimeSeconds: 20,
        AttributeNames: ["ApproximateReceiveCount"],
      });

      const { Messages } = await sqs.send(command);

      if (!Messages || Messages.length === 0) continue;

      const message = Messages[0];

      try {
        await processEmailJob(message);

        // ✅ success → delete from queue
        await sqs.send(
          new DeleteMessageCommand({
            QueueUrl: QUEUE_URL,
            ReceiptHandle: message.ReceiptHandle,
          })
        );

        console.log("✅ Message deleted from queue");
      } catch (error) {
        await handleFailure(message, error);
      }
    } catch (err) {
      console.error("Polling error:", err);
      await sleep(5000);
    }
  }
}

pollQueue();