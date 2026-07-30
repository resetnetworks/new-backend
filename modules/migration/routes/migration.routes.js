import express from "express";
import {
  postBandcampMigration,
  getMigrationStatus,
  getMigrationAlbums,
  getMigrationTracks,
  postRetryMigration,
  postImportMigration,
  getDraftAlbums,
  getDraftAlbumDetails,
  patchDraftAlbum,
  patchDraftTrack,
  publishDraftAlbum,
} from "../controllers/migration.controller.js";
import {
  createBandcampMigrationValidator,
  migrationIdValidator,
} from "../validators/migration.validator.js";
import validateRequest from "../../../middleware/validate.js";

const router = express.Router();

// --- Core Migration Job Management ---
router.post(
  "/bandcamp",
  createBandcampMigrationValidator,
  validateRequest,
  postBandcampMigration
);

// --- Draft Staging Area (Static & specific routes must be defined first) ---
router.get(
  "/drafts/albums",
  getDraftAlbums
);

router.get(
  "/drafts/albums/:id",
  migrationIdValidator,
  validateRequest,
  getDraftAlbumDetails
);

router.patch(
  "/drafts/albums/:id",
  migrationIdValidator,
  validateRequest,
  patchDraftAlbum
);

router.patch(
  "/drafts/tracks/:id",
  migrationIdValidator,
  validateRequest,
  patchDraftTrack
);

router.post(
  "/drafts/albums/:id/publish",
  migrationIdValidator,
  validateRequest,
  publishDraftAlbum
);

// --- Dynamic parameter routes defined last ---
router.get(
  "/:id",
  migrationIdValidator,
  validateRequest,
  getMigrationStatus
);

router.get(
  "/:id/albums",
  migrationIdValidator,
  validateRequest,
  getMigrationAlbums
);

router.get(
  "/:id/tracks",
  migrationIdValidator,
  validateRequest,
  getMigrationTracks
);

router.post(
  "/:id/retry",
  migrationIdValidator,
  validateRequest,
  postRetryMigration
);

router.post(
  "/:id/import",
  migrationIdValidator,
  validateRequest,
  postImportMigration
);

export default router;
