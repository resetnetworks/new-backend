import mongoose from "mongoose";

const playEventSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    songId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Song",
      required: true,
      index: true,
    },

    playedAt: {
      type: Number, // unix timestamp (seconds)
      required: true,
      index: true,
    },
  },
  {
    versionKey: false,
  }
);

// Critical index for CSV generation
playEventSchema.index({ userId: 1, playedAt: -1 });
playEventSchema.index({ songId: 1 });

export const PlayEvent =
  mongoose.models.PlayEvent || mongoose.model("PlayEvent", playEventSchema);