// modules/analytics/domain/models/ArtistDailyStats.js
import mongoose from "mongoose";

const artistDailyStatsSchema = new mongoose.Schema(
  {
    artistId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Artist",
      required: true,
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
      type: Number,
      default: 0,
      min: 0,
    },
    uniqueListeners: {
      type: [String],
      default: [],
    },
    uniqueListenersCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    likes: {
      type: Number,
      default: 0,
    },
    followers: {
      type: Number,
      default: 0,
    },
    subscriptionsStarted: {
      type: Number,
      default: 0,
      min: 0,
    },
    subscriptionsRenewed: {
      type: Number,
      default: 0,
      min: 0,
    },
    purchasesCompleted: {
      type: Number,
      default: 0,
      min: 0,
    },
    revenueCents: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// One document per artist per day
artistDailyStatsSchema.index({ artistId: 1, date: 1 }, { unique: true });

export const ArtistDailyStats = mongoose.model("ArtistDailyStats", artistDailyStatsSchema);
