import { Song } from "../models/song.model.js";
import { Subscription } from "../models/Subscription.js";
import { User } from "../models/User.js";
import { Album } from "../models/album.model.js";
import { isAdmin } from "../utils/authHelper.js";
import mongoose from "mongoose";
import { Transaction } from "../models/Transaction.js";



export const canStreamSong = async (userId, song) => {
  if (song.accessType === "free") return true;

  const user = await User.findById(userId)
    .select("role artistId")
    .lean();

  if (!user) return false;
  if (isAdmin(user)) return true;

  if (
    user.role === "artist" &&
    user.artistId &&
    String(song.artist) === String(user.artistId)
  ) return true;

  if (song.accessType === "subscription") {
    return await Subscription.exists({
      userId,
      artistId: song.artist,
      status: { $in: ["active", "cancelled"] },
      validUntil: { $gt: new Date() },
    });
  }

  if (song.accessType === "purchase-only") {
    if (song.albumOnly) {
      return await Transaction.exists({
        userId,
        album: song.albumId,
        itemType: "album",
        status: "paid",
      });
    }

    return await Transaction.exists({
      userId,
      song: song._id,
      itemType: "song",
      status: "paid",
    });
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

