// controllers/userDashboardController.js

import { Song } from "../models/song.model.js";
import { Album } from "../models/album.model.js";
import { User } from "../models/User.js";
import { StatusCodes } from "http-status-codes";
import { NotFoundError } from "../errors/index.js";
import { Subscription } from "../models/Subscription.js";
import { Artist } from "../models/Artist.js";
import { Transaction } from "../models/Transaction.js";

/**
 * @desc Fetch user purchases: songs, albums, and purchase history
 * @route GET /api/dashboard/purchases
 * @access Private
 */
export const getUserPurchases = async (req, res) => {
  const userId = req.user?._id;

  if (!userId) {
    return res.status(StatusCodes.UNAUTHORIZED).json({
      success: false,
      message: "Unauthorized",
    });
  }

  // 1️⃣ Fetch successful single-purchase transactions
  const transactions = await Transaction.find({
    userId,
    status: "paid",
    itemType: { $in: ["song", "album"] },
  })
    .select("itemType itemId createdAt amount currency")
    .lean();

  if (!transactions.length) {
    return res.status(StatusCodes.OK).json({
      success: true,
      songs: [],
      albums: [],
      history: [],
    });
  }

  // 2️⃣ Split IDs by type
  const songIds = [];
  const albumIds = [];

  for (const tx of transactions) {
    if (tx.itemType === "song") songIds.push(tx.itemId);
    if (tx.itemType === "album") albumIds.push(tx.itemId);
  }

  // 3️⃣ Fetch entities
  const [songs, albums] = await Promise.all([
    Song.find({ _id: { $in: songIds } })
      .select("title duration coverImage artist")
      .populate("artist", "name")
      .lean(),

    Album.find({ _id: { $in: albumIds } })
      .select("title coverImage artist slug")
      .populate("artist", "name")
      .lean(),
  ]);

  // 4️⃣ Build history (payment-level, not entity-level)
  const history = transactions.map((tx) => ({
    itemType: tx.itemType,
    itemId: tx.itemId,
    amount: tx.amount,
    currency: tx.currency,
    purchasedAt: tx.createdAt,
  }));

  return res.status(StatusCodes.OK).json({
    success: true,
    songs,
    albums,
    history,
  });
};



// ✅ GET /api/users/subscriptions
export const getUserSubscriptions = async (req, res) => {
  const userId = req.user._id;

  // 1. Fetch active subscriptions
  const subscriptions = await Subscription.find({
    userId,
    status: "active",
    validUntil: { $gt: new Date() },
  }).lean();

  if (subscriptions.length === 0) {
    return res.status(StatusCodes.OK).json({
      success: true,
      subscriptions: [],
    });
  }

  // 2. Fetch artist info for each subscription
  const artistIds = subscriptions.map((sub) => sub.artistId);
  const artists = await Artist.find({ _id: { $in: artistIds } })
    .select("name image genre slug")
    .lean();

  // 3. Merge artist info with subscription data
  const subscriptionsWithArtistInfo = subscriptions.map((sub) => {
    const artist = artists.find((a) => a._id.toString() === sub.artistId.toString());
    return {
      ...sub,
      artist,
    };
  });

  // 4. Respond
  return res.status(StatusCodes.OK).json({
    success: true,
    subscriptions: subscriptionsWithArtistInfo,
  });
};



// ✅ DELETE /api/users/subscriptions/:artistId
export const cancelArtistSubscription = async (req, res) => {
  const userId = req.user._id;
  const { artistId } = req.params;

  const subscription = await Subscription.findOne({
    userId,
    artistId,
    status: "active",
    validUntil: { $gt: new Date() },
  });

  if (!subscription) {
    throw new NotFoundError("No active subscription found for this artist.");
  }

  // Mark it as cancelled (soft cancel)
  subscription.status = "cancelled";
  subscription.validUntil = new Date(); // expire immediately
  await subscription.save();

  return res.status(StatusCodes.OK).json({
    success: true,
    message: "Subscription cancelled successfully.",
  });
};
