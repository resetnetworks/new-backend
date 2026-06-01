import connectDb from "./db/db.js";
import { processNotificationBatch } from "./notification.consumer.js";

export const handler = async (event) => {
  try {
    await connectDb();

    await processNotificationBatch(event.Records);

    return {
      statusCode: 200,
      body: "Notifications processed successfully",
    };
  } catch (error) {
    console.error("[NOTIFICATION LAMBDA ERROR]:", error);
    throw error;
  }
};