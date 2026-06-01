import {
  getUserNotifications,
  getUnreadNotificationCount,
  markAllNotificationsAsRead,
} from "./notification.service.js";

export const fetchNotifications =
  async (req, res, next) => {
    try {
      const userId = req.user._id;

      const data =
        await getUserNotifications({userId,});

      return res.status(200).json({
        success: true,
        ...data,
      });
    } catch (error) {
      next(error);
    }
  };

export const fetchUnreadCount =
  async (req, res, next) => {
    try {
      const userId = req.user._id;

      const count =
        await getUnreadNotificationCount({userId,});

      return res.status(200).json({
        success: true,
        count,
      });
    } catch (error) {
      next(error);
    }
  };

export const readAllNotifications =
  async (req, res, next) => {
    try {
      const userId = req.user._id;

      await markAllNotificationsAsRead({
        userId,
      });

      return res.status(200).json({
        success: true,
        message:
          "Notifications marked as read",
      });
    } catch (error) {
      next(error);
    }
  };