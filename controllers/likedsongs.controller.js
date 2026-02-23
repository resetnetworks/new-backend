import { StatusCodes } from "http-status-codes";
import mongoose from "mongoose";

import { LikedSong } from "../models/likedSong.model.js";
import { Song } from "../models/song.model.js";
import {
  BadRequestError,
  NotFoundError,
} from "../errors/index.js";

/* ======================================================
   LIKE A SONG
   ====================================================== */
/**
 * POST /songs/:songId/like
 */
export const likeSong = async (req, res) => {
  const userId = req.user._id;
  const { songId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(songId)) {
    throw new BadRequestError("Invalid song id");
  }

  // Optional: ensure song exists & is likable
  const song = await Song.findOne({
    _id: songId,
    isDeleted: false,
    // status: "ready",
  }).select("_id");

  if (!song) {
    throw new NotFoundError("Song not found");
  }

  try {
    const liked = await LikedSong.create({ userId, songId, });

    return res.status(StatusCodes.CREATED).json({
      message: "Song liked",
      liked,
    });
  } catch (err) {
    // Duplicate like (unique index)
    if (err.code === 11000) {
      return res.status(StatusCodes.OK).json({
        message: "Song already liked",
      });
    }
    throw err;
  }
};

/* ======================================================
   UNLIKE A SONG
   ====================================================== */
/**
 * DELETE /songs/:songId/like
 */
export const unlikeSong = async (req, res) => {
  const userId = req.user._id;
  const { songId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(songId)) {
    throw new BadRequestError("Invalid song id");
  }

  await LikedSong.deleteOne({
    userId,
    songId,
  });

  return res.status(StatusCodes.OK).json({
    message: "Song unliked",
  });
};

/* ======================================================
   GET USER LIKED SONGS (PAGINATED)
   ====================================================== */
/**
 * GET /me/liked-songs
 * query: ?limit=50
 */
export const getMyLikedSongs = async (req, res) => {
  const userId = req.user._id;

  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const skip = (page - 1) * limit;

  const likedSongs = await LikedSong.find({ userId })
    .sort({ likedAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate({
      path: "songId",
      match: { isDeleted: false },
    });

  const cleaned = likedSongs.filter(ls => ls.songId);

  const total = await LikedSong.countDocuments({ userId });

  res.status(StatusCodes.OK).json({
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    data: cleaned,
  });
};


/* ======================================================
   CHECK IF USER LIKED A SONG
   ====================================================== */
/**
 * GET /songs/:songId/is-liked
 */
// export const isSongLikedByUser = async (req, res) => {
//   const userId = req.user._id;
//   const { songId } = req.params;

//   if (!mongoose.Types.ObjectId.isValid(songId)) {
//     throw new BadRequestError("Invalid song id");
//   }

//   const exists = await LikedSong.exists({
//     userId,
//     songId,
//   });

//   res.status(StatusCodes.OK).json({
//     liked: Boolean(exists),
//   });
// };

/* ======================================================
   GET LIKE COUNT FOR A SONG
   ====================================================== */
/**
 * GET /songs/:songId/likes/count
 */
export const getSongLikeCount = async (req, res) => {
  const { songId } = req.params;

  if (!mongoose.Types.ObjectId.isValid(songId)) {
    throw new BadRequestError("Invalid song id");
  }

  const count = await LikedSong.countDocuments({ songId });

  res.status(StatusCodes.OK).json({
    songId,
    likes: count,
  });
};

/* ======================================================
   TRENDING SONGS (LAST N DAYS)
   ====================================================== */
/**
 * GET /songs/trending?days=7&limit=20
 */
export const getTrendingSongs = async (req, res) => {
  const days = Math.min(Number(req.query.days) || 7, 30);
  const limit = Math.min(Number(req.query.limit) || 20, 50);

  const since = new Date();
  since.setDate(since.getDate() - days);

  const trending = await LikedSong.aggregate([
    { $match: { likedAt: { $gte: since } } },
    {
      $group: {
        _id: "$songId",
        likes: { $sum: 1 },
      },
    },
    { $sort: { likes: -1 } },
    { $limit: limit },
  ]);

  res.status(StatusCodes.OK).json({
    message: "Trending songs fetched successfully",
    meta: {
      days,
      limit,
      total: trending.length,
    },
    data: trending,
  });

};
