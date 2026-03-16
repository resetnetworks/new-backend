import { Subscription } from "../models/Subscription.js";
import { User } from "../models/User.js";
import { Transaction } from "../models/Transaction.js";
import { isAdmin } from "../utils/authHelper.js";

export const canAccessSong = async (userId, song) => {

  // Free songs are accessible to everyone
  if (song.accessType === "free") {
    return true;
  }

  const user = await User.findById(userId)
    .select("role artistId")
    .lean();

  if (!user) return false;

  if (isAdmin(user)) return true;

  // Artist can access own songs
  if (
    user.role === "artist" &&
    user.artistId &&
    song.artist.equals(user.artistId)
  ) {
    return true;
  }

  // Subscription access
  if (song.accessType === "subscription") {
    const subscriptionExists = await Subscription.exists({
      userId,
      artistId: song.artist,
      status: { $in: ["active", "cancelled"] },
      validUntil: { $gt: new Date() }
    });

    return Boolean(subscriptionExists);
  }

  // Purchase access
  if (song.accessType === "purchase-only") {

    if (song.albumOnly) {
      const albumPurchase = await Transaction.exists({
        userId,
        album: song.albumId,
        itemType: "album",
        status: "paid"
      });

      return Boolean(albumPurchase);
    }

    const songPurchase = await Transaction.exists({
      userId,
      song: song._id,
      itemType: "song",
      status: "paid"
    });

    return Boolean(songPurchase);
  }

  return false;
};