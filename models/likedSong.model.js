// models/LikedSong.js
import mongoose from "mongoose";

const likedSongSchema = new mongoose.Schema(
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

    likedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: false }
);

// 🚫 Prevent duplicate likes
likedSongSchema.index(
  { userId: 1, songId: 1 },
  { unique: true }
);

// 🔥 Trending / analytics
likedSongSchema.index({ songId: 1, likedAt: -1 });

// 🕵️‍♂️ User activity feed
likedSongSchema.index({ userId: 1, likedAt: -1 });


export const LikedSong =
  mongoose.models.LikedSong ||
  mongoose.model("LikedSong", likedSongSchema);
