import { FavoriteArtist } from "../models/FavoriteArtist.js";



export const addFavoriteArtistService = async ({ userId, artistId }) => {
  // optional: validate artist exists

  const existing = await FavoriteArtist.findOne({ user: userId, artist: artistId });

  if (existing) return existing; // idempotent

  return FavoriteArtist.create({
    user: userId,
    artist: artistId,
  });
};



export const removeFavoriteArtistService = async ({ userId, artistId }) => {
  return FavoriteArtist.findOneAndDelete({
    user: userId,
    artist: artistId,
  });
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