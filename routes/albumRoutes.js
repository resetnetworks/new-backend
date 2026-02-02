import express from "express";
import { authenticateUser } from "../middleware/authenticate.js";
import { authorizeRoles } from "../middleware/authorize.js";

import {
  createAlbumController,
  getAllAlbumsController,
  getAllAlbumsWithoutPaginationController,
  getAlbumByIdController,
  updateAlbumController,
  getAlbumsByArtistController,
} from "../controllers/albumController.js";

import {
  createAlbumValidator,
  updateAlbumValidator,
  albumIdValidator,
} from "../validators/albumValidators.js";

import validate from "../middleware/validate.js";

const router = express.Router();

/* ===========================
   WRITE (ARTIST)
   =========================== */

// Create album
router.post(
  "/",
  authenticateUser,
  authorizeRoles("artist"),
  createAlbumValidator,
  validate,
  createAlbumController
);

// Update album (partial)
router.patch(
  "/:id",
  authenticateUser,
  authorizeRoles("artist"),
  updateAlbumValidator,
  validate,
  updateAlbumController
);

// Delete album (soft delete)
// router.delete(
//   "/:id",
//   authenticateUser,
//   authorizeRoles("artist"),
//   albumIdValidator,
//   validate,
//   deleteAlbum
// );

/* ===========================
   READ (PUBLIC)
   =========================== */

// Get all albums (paginated)
router.get("/", getAllAlbumsController);

// Get all albums (no pagination – dropdowns/admin tools)
router.get("/find-all", getAllAlbumsWithoutPaginationController);

// Get albums by artist
router.get("/artist/:artistId", getAlbumsByArtistController);

// Get album by id or slug
router.get(
  "/:id",
  albumIdValidator,
  validate,
  getAlbumByIdController
);

export default router;