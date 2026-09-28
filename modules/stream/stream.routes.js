import express from "express";
import { streamSong, getStreamKey } from "./stream.controller.js";
import { authenticateUser } from "../../middleware/authenticate.js";

const router = express.Router();

router.get("/song/:id", authenticateUser, streamSong);
router.get("/key/:uuid", authenticateUser, getStreamKey);

export default router;


