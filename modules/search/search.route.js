import express from "express";
import { searchSongs, searchArtists, searchAlbums, unifiedSearch } from "./search.controller.js";

const router = express.Router();

router.get("/", unifiedSearch);
router.get("/songs", searchSongs);
router.get("/artists", searchArtists);
router.get("/albums", searchAlbums);

export default router;
