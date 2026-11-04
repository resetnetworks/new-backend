// modules/analytics/domain/models/SongDailyStats.js
import mongoose from "mongoose";

const songDailyStatsSchema = new mongoose.Schema(
  {
    songId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Song",
      required: true,
      index: true,
    },
    artistId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Artist",
      default: null,
      index: true,
    },
    date: {
      type: String, // Format: "YYYY-MM-DD"
      required: true,
      index: true,
    },
    plays: {
      type: Number,
      default: 0,
      min: 0,
    },
    qualifiedPlays: {
      type: Number, // Count of playback_30s
      default: 0,
      min: 0,
    },
    completions: {
      type: Number,
      default: 0,
      min: 0,
    },
    skips: {
      type: Number,
      default: 0,
      min: 0,
    },
    likes: {
      type: Number,
      default: 0,
    },
    uniqueListeners: {
      type: [String], // Array of unique (userId || anonymousId)
      default: [],
    },
    uniqueListenersCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

// One document per song per day
songDailyStatsSchema.index({ songId: 1, date: 1 }, { unique: true });
songDailyStatsSchema.index({ artistId: 1, date: 1 });

export const SongDailyStats = mongoose.model("SongDailyStats", songDailyStatsSchema);
