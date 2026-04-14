import express from "express";
import {
  createPlaylist,
  deletePlaylist,
  removeSongFromPlaylist,
  getPlaylistById,
  updatePlaylist,
  addSongToPlaylist,
  getMyPlaylists,
  getPublicPlaylists,
} from "../controllers/playlistController.js";

import { authenticateUser } from "../middleware/authenticate.js";

import {
  createPlaylistValidator,
  updatePlaylistValidator,
  playlistIdValidator,
  addSongToPlaylistValidator,
  removeSongFromPlaylistValidator,
} from "../validators/playlistValidators.js";

import validate from "../middleware/validate.js";

const router = express.Router();

/* ======================================================
   PLAYLIST CRUD
   ====================================================== */

// Create playlist
router.post(
  "/",
  authenticateUser,
  createPlaylistValidator,
  validate,
  createPlaylist
);

// Get user's playlists
router.get("/mine", authenticateUser, getMyPlaylists);

// Get public playlists
router.get("/public", getPublicPlaylists);

// Get single playlist
router.get(
  "/:id",
  authenticateUser,
  playlistIdValidator,
  validate,
  getPlaylistById
);

// Update playlist (partial update → PATCH)
router.patch(
  "/:id",
  authenticateUser,
  updatePlaylistValidator,
  validate,
  updatePlaylist
);

// Delete playlist
router.delete(
  "/:id",
  authenticateUser,
  playlistIdValidator,
  validate,
  deletePlaylist
);

/* ======================================================
   SONG MANAGEMENT
   ====================================================== */

// Add song(s) to playlist
router.post(
  "/:id/songs",
  authenticateUser,
  addSongToPlaylistValidator,
  validate,
  addSongToPlaylist
);

// Remove song(s) from playlist
router.delete(
  "/:id/songs/:songId",
  authenticateUser,
  removeSongFromPlaylistValidator,
  validate,
  removeSongFromPlaylist
);

export default router;
