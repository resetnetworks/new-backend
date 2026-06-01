import Notification from "../models/notification.model.js";

export const getUserNotifications = async ({
  userId,
  limit = 20,
}) => {
  const notifications =
    await Notification.find({
      userId,
    })
      .sort({ createdAt: -1 })
      .limit(limit);

  const unreadCount =
    await Notification.countDocuments({
      userId,
      isRead: false,
    });

  return {
    notifications,
    unreadCount,
  };
};

export const getUnreadNotificationCount =
  async ({ userId }) => {
    const count =
      await Notification.countDocuments({
        userId,
        isRead: false,
      });

    return count;
  };

export const markAllNotificationsAsRead =
  async ({ userId }) => {
    await Notification.updateMany(
      {
        userId,
        isRead: false,
      },
      {
        isRead: true,
        readAt: new Date(),
      }
    );

    return true;
  };