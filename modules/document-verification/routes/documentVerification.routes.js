import express from "express";
import {
  presignIdentityDocumentUpload,
  getPresignedViewUrl,
} from "../controllers/documentVerification.controller.js";
import { authenticateUser } from "../../../middleware/authenticate.js";

const router = express.Router();

router.post("/presign-upload", authenticateUser, presignIdentityDocumentUpload);
router.get("/view/:referenceId", authenticateUser, getPresignedViewUrl);

export default router;
