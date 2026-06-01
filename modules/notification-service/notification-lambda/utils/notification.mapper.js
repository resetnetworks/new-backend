export const mapNotificationPayload = (payload) => {
  return {
    userId: payload.userId,
    type: payload.type,
    title: payload.title,
    body: payload.body,
    data: payload.data || {},
    channels: payload.channels || ["web"],
    status: "sent",
  };
};