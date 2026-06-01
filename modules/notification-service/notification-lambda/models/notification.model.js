import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    type: {
      type: String,
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
    },

    body: {
      type: String,
      required: true,
    },

    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    channels: {
      type: [String],
      enum: ["web", "email", "push"],
      default: ["web"],
    },

    status: {
      type: String,
      enum: ["queued", "sent", "failed"],
      default: "queued",
    },

    isRead: {
      type: Boolean,
      default: false,
    },

    readAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);


notificationSchema.index({
  userId: 1,
  isRead: 1,
  createdAt: -1,
});


const Notification = mongoose.model(
  "Notification",
  notificationSchema
);

export default Notification;