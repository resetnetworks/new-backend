import express from "express";
import { playbackStarted } from "./playback.controller.js";
import {authenticateUser } from "../../middleware/authenticate.js";

const router = express.Router();

router.post("/playback-started", authenticateUser, playbackStarted);

export default router;