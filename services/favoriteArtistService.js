import { FavoriteArtist } from "../models/FavoriteArtist.js";
import { eventDispatcher, EVENT_TYPES } from "../modules/analytics/index.js";

export const addFavoriteArtistService = async ({ userId, artistId }) => {
  // optional: validate artist exists

  const existing = await FavoriteArtist.findOne({ user: userId, artist: artistId });

  if (existing) return existing; // idempotent

  const created = await FavoriteArtist.create({
    user: userId,
    artist: artistId,
  });

  // Non-blocking dispatch to analytics pipeline
  eventDispatcher.publish({
    eventName: EVENT_TYPES.ARTIST_FOLLOWED,
    userId,
    artistId,
  });

  return created;
};

export const removeFavoriteArtistService = async ({ userId, artistId }) => {
  const deleted = await FavoriteArtist.findOneAndDelete({
    user: userId,
    artist: artistId,
  });

  if (deleted) {
    // Non-blocking dispatch to analytics pipeline
    eventDispatcher.publish({
      eventName: EVENT_TYPES.ARTIST_UNFOLLOWED,
      userId,
      artistId,
    });
  }

  return deleted;
};



export const getUserFavoriteArtistsService = async ({
  userId,
  page = 1,
  limit = 10,
}) => {
  const skip = (page - 1) * limit;

  const favorites = await FavoriteArtist.find({ user: userId })
    .populate("artist", "name slug profileImage")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  return favorites;
};



export const isArtistFavoritedService = async ({ userId, artistId }) => {
  const exists = await FavoriteArtist.exists({
    user: userId,
    artist: artistId,
  });

  return !!exists;
};