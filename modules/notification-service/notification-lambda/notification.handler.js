import Notification from "./models/notification.model.js";

import { mapNotificationPayload } from "./utils/notification.mapper.js";

export const handleNotification = async (
  payload
) => {
  try {
    const notificationData =
      mapNotificationPayload(payload);

    const notification =
      await Notification.create(notificationData);

    console.log(`[NOTIFICATION SAVED]: ${notification._id}`);

    return notification;
  } catch (error) {
    console.error("[NOTIFICATION HANDLER ERROR]:", error);

    throw error;
  }
};