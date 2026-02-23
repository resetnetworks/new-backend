import express from "express";

import {
  likeSong,
  unlikeSong,
  getMyLikedSongs,
  getSongLikeCount,
  getTrendingSongs,
} from "../controllers/likedsongs.controller.js";

import { authenticateUser } from "../modules/auth/middlewares/auth.middleware.js";

const router = express.Router();

//======================================================
//   USER LIKES
//======================================================

// Like a song
// POST /songs/:songId/like
router.post( "/songs/:songId/like", authenticateUser, likeSong );

// Unlike a song
// DELETE /songs/:songId/like
router.delete( "/songs/:songId/like", authenticateUser, unlikeSong );

// Get logged-in user's liked songs
// GET /me/liked-songs?page=1&limit=20
router.get( "/me/liked-songs", authenticateUser, getMyLikedSongs );

//======================================================
//   SONG ANALYTICS
//====================================================== */

// Get like count for a so 
// GET /songs/:songId/likes/count
router.get( "/songs/:songId/likes/count", getSongLikeCount );

// Get trending songs
// GET /songs/trending?days=7&limit=20
router.get( "/songs/trending", getTrendingSongs );

export default router;
