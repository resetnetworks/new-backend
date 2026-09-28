import express from "express";
import {
  getUnverifiedSongs,
  verifySong,
  takedownSong,
  runCopyrightScan,
} from "../controllers/adminCopyrightController.js";
import { authenticateUser } from "../middleware/authenticate.js";

const router = express.Router();

router.get("/unverified", authenticateUser, getUnverifiedSongs);
router.post("/verify/:songId", authenticateUser, verifySong);
router.post("/takedown/:songId", authenticateUser, takedownSong);
router.post("/scan/:songId", authenticateUser, runCopyrightScan);

export default router;
