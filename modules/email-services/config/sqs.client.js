import { SQSClient } from "@aws-sdk/client-sqs";

// console.log("☣️ ☣️ ☣️ ☣️ ☣️--SQS ENV START--☣️ ☣️ ☣️ ☣️ ☣️"")
// console.log("AWS ACCESS KEY:", process.env.AWS_ACCESS_KEY_ID);
// console.log("AWS SECRET KEY:", process.env.AWS_SECRET_ACCESS_KEY);
// console.log("☣️ ☣️ ☣️ ☣️ ☣️--SES ENV END--☣️ ☣️ ☣️ ☣️ ☣️"")

export const sqsClient = new SQSClient({
  rregion: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

export const EMAIL_QUEUE_URL = process.env.SQS_EMAIL_QUEUE_URL;