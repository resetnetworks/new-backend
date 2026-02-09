import { body, param } from "express-validator";
import mongoose from "mongoose";

export const createAlbumValidator = [
  // Title
  body("title")
    .trim()
    .notEmpty()
    .withMessage("Album title is required")
    .isLength({ min: 2, max: 100 })
    .withMessage("Album title must be between 2 and 100 characters"),

  // Description
  body("description")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Description must not exceed 1000 characters"),

  // Release date
  body("releaseDate")
    .optional()
    .isISO8601()
    .toDate()
    .withMessage("Invalid release date"),

  // Cover image key (presigned upload result)
  body("coverImageKey")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Invalid cover image key"),

  // Genre
  body("genre")
    .optional()
    .isArray()
    .withMessage("Genre must be an array"),


  body("songs.*")
    .custom((value) => mongoose.Types.ObjectId.isValid(value))
    .withMessage("Each song must be a valid ID"),

  // Access type
  body("accessType")
    .optional()
    .isIn(["free", "subscription", "purchase-only"])
    .withMessage("Invalid access type"),

  // Base price (required for purchase-only)
  body("basePrice")
    .if(body("accessType").equals("purchase-only"))
    .exists()
    .withMessage("Base price is required for purchase-only albums")
    .isObject()
    .withMessage("Base price must be an object"),

  body("basePrice.currency")
    .if(body("accessType").equals("purchase-only"))
    .isString()
    .isLength({ min: 3, max: 3 })
    .withMessage("Currency must be a valid ISO code"),

  body("basePrice.amount")
    .if(body("accessType").equals("purchase-only"))
    .isNumeric()
    .custom((value) => value > 0)
    .withMessage("Price amount must be greater than zero"),

  // Prevent empty payload edge case
  body().custom((_, { req }) => {
    if (!Object.keys(req.body).length) {
      throw new Error("Request body cannot be empty");
    }
    return true;
  }),
];

export const updateAlbumValidator = [
  // Album ID
  param("id")
    .custom((value) => mongoose.Types.ObjectId.isValid(value))
    .withMessage("Invalid album ID"),

  // Title
  body("title")
    .optional()
    .isString()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Album title must be between 2 and 100 characters"),

  // Description
  body("description")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Description must not exceed 1000 characters"),

  // Release date
  body("releaseDate")
    .optional()
    .isISO8601()
    .toDate()
    .withMessage("Invalid release date"),

  // Cover image key (presigned upload)
  body("coverImageKey")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Invalid cover image key"),

  // Genre
  body("genre")
    .optional()
    .isArray()
    .withMessage("Genre must be an array"),

  body("genre.*")
    .optional()
    .isString()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("Each genre must be a valid string"),

  // Access type
  body("accessType")
    .optional()
    .isIn(["free", "subscription", "purchase-only"])
    .withMessage("Invalid access type"),

  // Base price (only for purchase-only)
  body("basePrice")
    .optional()
    .isObject()
    .withMessage("Base price must be an object"),

  body("basePrice.currency")
    .if(body("basePrice").exists())
    .isString()
    .isLength({ min: 3, max: 3 })
    .withMessage("Currency must be a valid ISO code"),

  body("basePrice.amount")
    .if(body("basePrice").exists())
    .isNumeric()
    .custom((v) => v > 0)
    .withMessage("Price amount must be greater than zero"),

  // Songs (optional replace)
  body("songs")
    .optional()
    .isArray()
    .withMessage("Songs must be an array"),

  body("songs.*")
    .optional()
    .custom((value) => mongoose.Types.ObjectId.isValid(value))
    .withMessage("Each song must be a valid ID"),

  // Prevent empty PATCH
  body().custom((_, { req }) => {
    if (!Object.keys(req.body).length) {
      throw new Error("At least one field must be provided for update");
    }
    return true;
  }),
];

export const albumIdValidator = [
  param("id")
    .trim()
    .notEmpty()
    .withMessage("Album identifier is required")
    .custom((value) => {
      return (
        mongoose.Types.ObjectId.isValid(value) ||
        /^[a-z0-9-]+$/.test(value)
      );
    })
    .withMessage("Invalid album ID or slug"),
];