import { SendMessageCommand } from "@aws-sdk/client-sqs";
import { sqsClient, EMAIL_QUEUE_URL } from "../config/sqs.client.js";

import { markQueuedToSQS } from "../services/emailTracking.service.js";

export const EmailProducer = {
  async addJob(jobName, payload) {
    
    const message = {
      jobName,
      payload,
      timestamp: Date.now(),
    };
    
    console.log("--------------------")
    console.log("📩 Sending email event to SQS:", message);
    console.log("--------------------")

    const result = await sqsClient.send(
      new SendMessageCommand({
        QueueUrl: EMAIL_QUEUE_URL,
        MessageBody: JSON.stringify(message),
      })
    );

    // Log SQS accepted the message.
    if (payload.jobId) {
      await markQueuedToSQS(payload.jobId, result.MessageId);
      console.log(`📬 Email job ${payload.jobId} successfully queued to SQS.\nMessageId: ${result.MessageId}`);
    }
  },
};