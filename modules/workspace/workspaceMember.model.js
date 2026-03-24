import mongoose from "mongoose";

const workspaceMemberSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: true,
      index: true
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    role: {
      type: String,
      enum: ["owner", "manager", "editor", "analyst", "finance"],
      required: true
    },

    permissions: {
      uploadSong: { type: Boolean, default: false },
      editSong: { type: Boolean, default: false },
      deleteSong: { type: Boolean, default: false },
      viewAnalytics: { type: Boolean, default: false },
      viewPayments: { type: Boolean, default: false },
      changeSubscriptionPrice: { type: Boolean, default: false },
      manageTeam: { type: Boolean, default: false }
    },

    invitedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  },
  {
    timestamps: true
  }
);

// Prevent duplicate membership
workspaceMemberSchema.index(
  { workspaceId: 1, userId: 1 },
  { unique: true }
);

export const WorkspaceMember = mongoose.model(
  "WorkspaceMember",
  workspaceMemberSchema
);