// File: app.js
import "express-async-errors";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

// Security & core middleware
import cookieParser from "cookie-parser";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import xssClean from "xss-clean";
import mongoSanitize from "express-mongo-sanitize";

// Logging
import morgan from "morgan";
import { httpLogger } from "./middleware/http-logger.js";

// Auth & error handling
import passport from "./middleware/passport.js";
import notFoundMiddleware from "./middleware/not-found.js";
import errorHandlerMiddleware from "./middleware/errorhandler.js";

// Webhooks
import {
  stripeWebhook,
  razorpayWebhook,
  paypalWebhook,
} from "./controllers/webhookController.js";

// --------------------
// API V1 Routes
// --------------------
import userRoutes from "./routes/userRoutes.js";
import songRoutes from "./routes/songRoutes.js";
import albumRoutes from "./routes/albumRoutes.js";
import artistRoutes from "./routes/artistRoutes.js";
import playlistRoutes from "./routes/playlistRoutes.js";
import adminplaylistRoutes from "./routes/adminPlaylist.js";
import searchRoutes from "./routes/searchRoutes.js";
import discoverRoutes from "./routes/discoverRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import subscriptionRoutes from "./routes/subscriptionRoutes.js";
import streamRoutes from "./routes/streamRoutes.js";
import userDashboardRoutes from "./routes/userDashboardRoutes.js";
import artistDashboardRoutes from "./routes/artistDashboardRoutes.js";
import uploadRoutes2 from "./routes/uploadRoutes2.js";
import adminDashboardRoutes from "./routes/adminDashboardRoutes.js";

// --------------------
// API V2 Routes
// --------------------
import artistApplicationRoutes from "./modules/artist/routes/artist-application.routes.js";
import adminArtistRoutes from "./modules/artist/routes/artist-application.admin.routes.js";
import uploadRoutes from "./modules/upload/routes/upload.routes.js";
import monetizeRoutes from "./routes/monetizeRoutes.js";
import artistPayoutRoutes from "./modules/artist-payout/routes/artistPayoutRoutes.js";
import adminPayoutRoutes from "./modules/artist-payout/routes/adminPayoutRoutes.js";
import artistRevenueDashboardRoutes from "./modules/artist-payout/routes/artistDashboardRoutes.js";

// --------------------
// App setup
// --------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// --------------------
// Rate limiters
// --------------------
const paymentLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: {
    success: false,
    message: "Too many payment attempts. Try again later.",
  },
});

// --------------------
// Global middleware
// --------------------
app.set("trust proxy", 1);

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://musicreset.com",
      "http://127.0.0.1:5500",
      "https://musicreset-git-artist-reset-networks-projects.vercel.app",
    ],
    credentials: true,
  })
);

app.use(rateLimit({ windowMs: 5 * 60 * 1000, max: 300 }));
app.use(helmet());
app.use(httpLogger);

// --------------------
// Webhooks (must come before body parser)
// --------------------
app.post(
  "/api/webhooks/razorpay",
  express.raw({ type: "application/json" }),
  razorpayWebhook
);

app.post(
  "/api/webhooks/paypal",
  express.raw({ type: "application/json" }),
  paypalWebhook
);

// --------------------
// Body & security middleware
// --------------------
app.use(cookieParser());
app.use(express.json());
// app.use(morgan("combined"));
app.use(xssClean());
app.use(mongoSanitize());

// --------------------
// Auth
// --------------------
app.use(passport.initialize());

// --------------------
// API V1 Routes
// --------------------
app.use("/api/users", userRoutes);
app.use("/api/songs", songRoutes);
app.use("/api/albums", albumRoutes);
app.use("/api/playlist", playlistRoutes);
app.use("/api/artists", artistRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/discover", discoverRoutes);
app.use("/api/adminPlaylist", adminplaylistRoutes);
app.use("/api/payments", paymentLimiter, paymentRoutes);
app.use("/api/subscriptions", subscriptionRoutes);
app.use("/api/stream", streamRoutes);
app.use("/api/artist/dashboard", artistDashboardRoutes);
app.use("/api/uploads", uploadRoutes2);
app.use("/api/admin/dashboard", adminDashboardRoutes);

// --------------------
// API V2 Routes
// --------------------
app.use("/api/v2/artist", artistApplicationRoutes);
app.use("/api/v2/admin", adminArtistRoutes);
app.use("/api/v2/uploads", uploadRoutes);
app.use("/api/v2/monetize", monetizeRoutes);

app.use("/api/v2/artist", artistPayoutRoutes);
app.use("/api/v2/admin", adminPayoutRoutes);
app.use("/api/v2/artist", artistRevenueDashboardRoutes);

// --------------------
// 404 & Error handling
// --------------------
app.use(notFoundMiddleware);
app.use(errorHandlerMiddleware);

export default app;
export { app };
