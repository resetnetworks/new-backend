import mongoose from "mongoose";

const metaConnectionSchema = new mongoose.Schema(
  {
    artistId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Artist",
      required: true,
      unique: true,
    },

    // Facebook user who authorized the connection
    facebookUserId: {
      type: String,
      required: true,
    },

    // The Facebook Page this artist's ads will run from
    facebookPageId: {
      type: String,
      required: true,
    },
    facebookPageName: {
      type: String,
      required: true,
      trim: true,
    },
    facebookPagePicture: {
      type: String,
      default: "",
    },
    facebookPageCategory: {
      type: String,
      default: "",
    },
    facebookPageFanCount: {
      type: Number,
      default: 0,
    },

    // Encrypted tokens — NEVER stored in plain text
    pageAccessToken: {
      type: String,
      required: true,
    },
    userAccessToken: {
      type: String,
      required: true,
    },

    // Token expiry — long-lived tokens expire after ~60 days
    tokenExpiresAt: {
      type: Date,
      required: true,
    },

    // Connection state
    isConnected: {
      type: Boolean,
      default: true,
    },
    connectedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

metaConnectionSchema.index({ artistId: 1 });
metaConnectionSchema.index({ facebookPageId: 1 });
metaConnectionSchema.index({ tokenExpiresAt: 1 }); // for expiry cron jobs

export const MetaConnection = mongoose.model("MetaConnection", metaConnectionSchema);
