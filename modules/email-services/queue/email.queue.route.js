import express from "express";
import { getQueueJobs, clearQueue } from "./email.queue.controller.js";

const router = express.Router();

router.get("/get-queue", getQueueJobs);     // view queue
router.delete("/delete-queue", clearQueue);   // clear queue

export default router;