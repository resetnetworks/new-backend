import express from "express";
import { authenticateUser } from "../middleware/authenticate.js";
import { createPaypalSubscription, createRazorpaySubscription, createSetupIntent, initiateArtistSubscription, cancelArtistSubscription } from "../controllers/subscriptionController.js";

const router = express.Router();

// Initiate subscription for an artist
router.post(
  "/artist/:artistId",
  authenticateUser,
  createRazorpaySubscription,
);
router.post("/setup-intent", authenticateUser, createSetupIntent);

// routes/userRoutes.js
router.delete("/artist/:artistId", authenticateUser, cancelArtistSubscription);

router.post("/paypal/artist/:artistId", authenticateUser, createPaypalSubscription);


export default router;
