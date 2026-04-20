import express from "express";
import { authenticateUser } from "../middleware/authenticate.js";
import {
  addFavoriteArtistController,
  removeFavoriteArtistController,
  getUserFavoritesController,
  checkFavoriteController,
} from "../controllers/favoriteArtistController.js";
const router = express.Router();



router.post("/:artistId/favorite", authenticateUser, addFavoriteArtistController);

router.delete("/:artistId/favorite", authenticateUser, removeFavoriteArtistController);

router.get("/favorites", authenticateUser, getUserFavoritesController);

router.get("/:artistId/favorite", authenticateUser, checkFavoriteController);

export default router;