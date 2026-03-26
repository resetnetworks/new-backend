import express from "express";
import { getRandomArtistWithSongs, getExploreFeed } from "./discover.controller.js";

const router = express.Router();

router.get("/random-artist", getRandomArtistWithSongs);
router.get("/explore-feed", getExploreFeed);

export default router;
