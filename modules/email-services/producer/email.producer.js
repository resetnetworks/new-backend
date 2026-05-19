// import { emailQueue } from "./email.queue.js";

// export const EmailProducer = {

//   async addJob(jobName, payload) {

//     console.log("--------------------")
//     console.log("📩 Adding email job:", jobName, payload);
//     console.log("--------------------")

//     await emailQueue.add(jobName, payload, {
//       attempts: 5, // retry 5 times
//       backoff: {
//         type: "exponential",
//         delay: 30000, // 30 sec → 1m → 2m → 4m → 8m
//       },
//       removeOnComplete: true,
//       removeOnFail: false, // keep failed jobs for debugging
//     });
//   },
// };

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