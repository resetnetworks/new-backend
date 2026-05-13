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

export const EmailProducer = {
  async addJob(jobName, payload) {

    console.log("--------------------")
    console.log("📩 Adding email job:", jobName, payload);
    console.log("--------------------")
    
    const message = {
      jobName,
      payload,
      timestamp: Date.now(),
    };
    
    console.log("--------------------")
    console.log("SQS MESSAGE", message)
    console.log("--------------------")

    console.log("📩 Sending email event to SQS:", message);

    await sqsClient.send(
      new SendMessageCommand({
        QueueUrl: EMAIL_QUEUE_URL,
        MessageBody: JSON.stringify(message),
      })
    );
  },
};