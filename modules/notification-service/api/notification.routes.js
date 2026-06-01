import express from "express";

import {
  fetchNotifications,
  fetchUnreadCount,
  readAllNotifications,
} from "./notification.controller.js";

import { authenticateUser as protect } from "../../../middleware/authenticate.js";

const router = express.Router();

router.get("/", protect, fetchNotifications );

router.get("/unread-count", protect, fetchUnreadCount );

router.post("/read-all", protect, readAllNotifications );

export default router;