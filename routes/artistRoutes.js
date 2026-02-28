import express from "express";

/* =======================
   Middleware
======================= */
import { authenticateUser } from "../middleware/authenticate.js";
import { isAdmin } from "../middleware/isAdmin.js";
import { authorizeRoles } from "../middleware/authorize.js";

import validate from "../middleware/validate.js";

/* =======================
   Validators
======================= */
import {
  updateArtistValidator,
  artistIdValidator,
} from "../validators/artistValidators.js";

/* =======================
   Controllers
======================= */
import {
  updateArtistProfile,
  getAllArtistsController,
  getAllArtistsWithoutPagination,
  getArtistById,
  getArtistProfile,
} from "../controllers/artistController.js";

const router = express.Router();

/* =======================
   Routes
======================= */


// Update artist profile (artist only)
router.patch(
  "/me",
  authenticateUser,
  authorizeRoles("artist"),
  updateArtistValidator,
  validate,
  updateArtistProfile
);



// Get logged-in artist profile
router.get(
  "/profile/me",
  authenticateUser,
  authorizeRoles("artist"),
  getArtistProfile
);

// Get all artists (paginated)
router.get("/", getAllArtistsController);

// Get all artists (no pagination)
router.get("/all",  getAllArtistsWithoutPagination);

// Get artist by ID or slug
router.get("/:id",  getArtistById);

export default router;
