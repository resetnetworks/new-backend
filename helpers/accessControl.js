import { Song } from "../models/song.model.js";
import { Subscription } from "../models/Subscription.js";
import { User } from "../models/User.js";
import { Album } from "../models/album.model.js";
import { isAdmin } from "../utils/authHelper.js";
import mongoose from "mongoose";
import { Transaction } from "../models/Transaction.js";



export const canStreamSong = async (userId, songId) => {
  // ------------------ Validation ------------------
  if (
    !mongoose.Types.ObjectId.isValid(userId) ||
    !mongoose.Types.ObjectId.isValid(songId)
  ) {
    return false;
  }

  // ------------------ Fetch user (identity only) ------------------
  const user = await User.findById(userId)
    .select("role artistId")
    .lean();

  if (!user) return false;
  if (isAdmin(user)) return true;

  // ------------------ Fetch song ------------------
  const song = await Song.findById(songId)
    .select("accessType artist albumOnly")
    .lean();

  if (!song) return false;

  // ------------------ Rule 1: Free ------------------
  if (song.accessType === "free") return true;

  // ------------------ Rule 2: Artist owns the song ------------------
  if (
    user.role === "artist" &&
    user.artistId &&
    String(song.artist) === String(user.artistId)
  ) {
    return true;
  }

  // ------------------ Rule 3: Subscription ------------------
  if (song.accessType === "subscription") {
    const hasSubscription = await Subscription.exists({
      userId,
      artistId: song.artist,
      status: { $in: ["active", "cancelled"] },
      validUntil: { $gt: new Date() },
    });

    if (hasSubscription) return true;
  }

  // ------------------ Rule 4: Purchase-only ------------------
  if (song.accessType === "purchase-only") {
    // 4a️⃣ Album-only song → check album purchase
    if (song.albumOnly) {
      const album = await Album.findOne({ songs: song._id })
        .select("_id")
        .lean();

      if (!album) return false;

      const albumPurchased = await Transaction.exists({
        userId,
        album: album._id,
        itemType: "album",
        status: "success",
      });

      return !!albumPurchased;
    }

    // 4b️⃣ Single song purchase
    const songPurchased = await Transaction.exists({
      userId,
      song: song._id,
      itemType: "song",
      status: "paid",
    });
  console.log("Song purchased:", songPurchased);
  console.log("User ID:", userId, "Song ID:", songId);
    return !!songPurchased;
  }

  return false;
};


// helpers/accessControl.js



export const canStreamAlbum = async (userId, albumId) => {
  const album = await Album.findById(albumId).populate("artist");
  if (!album) return false;

  // Free access
  if (album.accessType === "free") return true;

  const user = await User.findById(userId);
  if (!user) return false;
  if(user.isAdmin) return true; // Admins can access everything
  if (album.accessType === "subscription") {
    const sub = await Subscription.findOne({
      userId,
      artistId: album.artist._id,
      status: "active",
      validUntil: { $gte: new Date() },
    });

    return !!sub;
  }

  if (album.accessType === "purchase-only") {
    return user.purchasedAlbums.includes(album._id);
  }

  return false;
};

