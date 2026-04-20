import mongoose from "mongoose";

const favoriteArtistSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    artist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Artist",
      required: true,
      index: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// prevent duplicates
favoriteArtistSchema.index({ user: 1, artist: 1 }, { unique: true });

export const FavoriteArtist = mongoose.model(
  "FavoriteArtist",
  favoriteArtistSchema
);