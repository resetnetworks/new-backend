// routes/streamRoutes.js
import express from "express";
import { streamSong, streamAlbum } from "../controllers/streamController.js";
import { authenticateUser } from "../middleware/authenticate.js";


const router = express.Router();

// Stream a specific song by ID
router.get("/song/:id", authenticateUser, streamSong);




// Stream a specific album by ID
router.get("/album/:id", authenticateUser, streamAlbum);

export default router;
