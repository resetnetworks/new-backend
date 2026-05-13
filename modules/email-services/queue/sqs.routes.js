import express from "express";
import { testSQS } from "./sqs.controller.js";

const router = express.Router();

router.get("/push-event", testSQS);

export default router;