import express from "express";

/* ===================== Middleware ===================== */
import { authenticateUser } from "../middleware/authenticate.js";
import { authorizeRoles } from "../middleware/authorize.js";
import { isArtistMonetized } from "../middleware/isMonetized.js";
import validate from "../middleware/validate.js";

/* ===================== Controllers ===================== */
import {
  createSongController,
  updateSongController,
  deleteSong,
  getAllSongsController,
  getSongByIdController,
  getAllSinglesController,
  getSongsMatchingUserGenresController,
  getSongsByGenreController,
  getSongsByAlbumController,
  getSongsByArtistController,
  getSinglesByArtistController,
  getLikedSongsController
} from "../controllers/songController.js";

/* ===================== Validators ===================== */
import {
  createSongValidator,
  updateSongValidator,
  songIdValidator
} from "../validators/songValidators.js";

const router = express.Router();

/* ======================================================
   USER LIBRARY & PERSONALIZED
   ====================================================== */
router.get(
  "/liked",
  authenticateUser,
  getLikedSongsController
);

router.get(
  "/matching-genre",
  authenticateUser,
  getSongsMatchingUserGenresController
);

/* ======================================================
   BROWSE / DISCOVERY
   ====================================================== */
router.get(
  "/",
  authenticateUser,
  getAllSongsController
);

router.get(
  "/singles",
  authenticateUser,
  getAllSinglesController
);

router.get(
  "/genre/:genre",
  authenticateUser,
  getSongsByGenreController
);

router.get(
  "/album/:albumId",
  authenticateUser,
  getSongsByAlbumController
);

router.get(
  "/artist/:artistId",
  authenticateUser,
  getSongsByArtistController
);

router.get(
  "/singles/artist/:artistId",
  authenticateUser,
  getSinglesByArtistController
);

/* ======================================================
   CRUD (ARTIST)
   ====================================================== */
router.post(
  "/",
  authenticateUser,
  authorizeRoles("artist"),
  isArtistMonetized,
  createSongValidator,
  validate,
  createSongController
);

router.patch(
  "/:id",
  authenticateUser,
  authorizeRoles("artist"),
  updateSongValidator,
  validate,
  updateSongController
);

router.delete(
  "/:id",
  authenticateUser,
  songIdValidator,
  validate,
  deleteSong
);

/* ======================================================
   SINGLE SONG (KEEP LAST)
   ====================================================== */
router.get(
  "/:id",
  authenticateUser,
  getSongByIdController
);

export default router;
