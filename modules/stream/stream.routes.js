import express from "express";
import { streamSong } from "./stream.controller.js";
import { authenticateUser } from "../../middleware/authenticate.js";

const router = express.Router();

router.get("/song/:id", authenticateUser, streamSong);

export default router;


