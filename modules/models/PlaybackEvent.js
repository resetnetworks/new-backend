import mongoose from "mongoose";

const playbackEventSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      index: true
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    songId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Song",
      required: true,
      index: true
    },

    eventType: {
      type: String,
      enum: ["playback_started"],
      required: true
    }
  },
  { timestamps: true }
);

export const PlaybackEvent = mongoose.model(
  "PlaybackEvent",
  playbackEventSchema
);