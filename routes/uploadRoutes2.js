import express from "express";
import { presignSongUpload, presignCoverImageUpload, presignProfileImageUpload } from "../controllers/presignUpload.js";
import { authenticateUser } from "../middleware/authenticate.js";

const router = express.Router();

/**
 * @route   POST /api/uploads/song/presign
 * @desc    Generate presigned URL for song audio upload
 * @access  Artist
 */
router.post(
  "/song/presign",
  authenticateUser,
  presignSongUpload
);

router.post(
  "/cover/presign",
  authenticateUser,
  presignCoverImageUpload
);

router.post(
  "/artist/presign",
  authenticateUser,
  presignProfileImageUpload
);

export default router;
