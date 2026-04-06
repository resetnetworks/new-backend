import express from "express";
import {
  getAllTransactionsByArtist,
  getPurchasedSongsByArtist,
  getPurchasedAlbumsByArtist,
  getSubscriberCount,
  getArtistRevenueSummary,
} from "./adminDashboard.controller.js";
import { authenticateUser } from "../../../middleware/authenticate.js"
const router = express.Router();

// All routes use isAuth to protect access
router.get("/transactions/:artistId", authenticateUser, getAllTransactionsByArtist);
router.get("/purchased-songs/:artistId", authenticateUser, getPurchasedSongsByArtist);
router.get("/purchased-albums/:artistId", authenticateUser, getPurchasedAlbumsByArtist);
router.get("/subscriber-count/:artistId", authenticateUser, getSubscriberCount);
router.get("/revenue-summary/:artistId", authenticateUser, getArtistRevenueSummary);

export default router;