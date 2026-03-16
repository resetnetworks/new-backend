import mongoose from "mongoose";

const recentlyPlayedSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true
    },

    songs: [
      {
        songId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Song"
        },
        playedAt: {
          type: Date,
          default: Date.now
        }
      }
    ]
  },
  { timestamps: true }
);

export const RecentlyPlayed = mongoose.model(
  "RecentlyPlayed",
  recentlyPlayedSchema
);