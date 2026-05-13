import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

const sqs  = new SQSClient({
  region: process.env.AWS_REGION,
});

export const publishEmailEvent = async(event) => {
  console.log("================", event)
  const command = new SendMessageCommand({
    QueueUrl: process.env.SQS_EMAIL_QUEUE_URL,
    MessageBody: JSON.stringify(event),
  });

  await sqs.send(command);
  console.log("Email event pushed to SQS ✅");
}