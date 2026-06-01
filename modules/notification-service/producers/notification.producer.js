import { SendMessageCommand,} from "@aws-sdk/client-sqs";
import sqsClient from "../config/sqs.client.js";

export const enqueueNotification = async ({
  userId,
  type,
  title,
  body,
  data = {},
  channels = ["web"],
}) => {
  try {
    const payload = {
      userId,
      type,
      title,
      body,
      data,
      channels,
      createdAt: new Date().toISOString(),
    };

    const command = new SendMessageCommand({
      QueueUrl: process.env.AWS_NOTIFICATION_QUEUE_URL,
      MessageBody: JSON.stringify(payload),
    });
    
    const response = await sqsClient.send(command);
    
    console.log(`\n✅ ✅ ✅ ✅ [NOTIFICATION QUEUED]: ${type} | MessageId: ${response.MessageId}\n`
    );

    return response;
  } catch (error) {
    console.error("❌ ❌ ❌ ❌ [NOTIFICATION PRODUCER ERROR]:", error );

    throw error;
  }
};


// ======================================================
// FAN-OUT EVENT QUEUE
// ======================================================
export const enqueueEvent = async ({
  type,
  title,
  body,
  data = {},
  channels = ["web"],
}) => {
  try {
    const payload = {
      type,
      title,
      body,
      data,
      channels,
      createdAt: new Date().toISOString(),
    };

    const command = new SendMessageCommand({
      QueueUrl:
        process.env.AWS_NOTIFICATION_QUEUE_URL,
        MessageBody: JSON.stringify(payload),
    });

    const response = await sqsClient.send(command);

    console.log(`\n🚀✅ ✅ ✅ ✅ [EVENT QUEUED]: ${type} | MessageId: ${response.MessageId}\n`);

    return response;
  } catch (error) {
    console.error("❌ ❌ ❌ ❌ [EVENT PRODUCER ERROR]:", error);

    throw error;
  }
};