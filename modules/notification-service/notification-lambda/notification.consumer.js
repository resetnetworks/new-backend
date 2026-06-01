import { dispatchNotification } from "./notification.dispatcher.js";

export const processNotificationBatch = async (
  records = []
) => {
  for (const record of records) {
    try {
      const payload = JSON.parse(record.body);

      await dispatchNotification(payload);

      // ==================================================
      // DIRECT USER NOTIFICATION
      // ==================================================
      if (payload.userId) {
        console.log(`[NOTIFICATION CONSUMED]: ${payload.type} | User: ${payload.userId}`);
      }

      // ==================================================
      // FAN-OUT EVENT
      // ==================================================
      else {
        `[FANOUT EVENT CONSUMED]: ${payload.type} | sourceArtistId: ${payload.data?.artistId}`
      }

    } catch (error) {
      console.error("[NOTIFICATION CONSUMER ERROR]:", error);

      throw error;
    }
  }
};