import { body, param } from "express-validator";
import { ARTIST_SOCIAL_PROVIDERS } from "../constants/artistSocials.js";

export const createArtistValidator = [
  body("name").trim().notEmpty().withMessage("Name is required"),
  body("bio").optional().trim().escape(),
  body("location").optional().trim().escape(),
  body("subscriptionPrice")
    .optional()
    .isNumeric().withMessage("Subscription price must be a number"),
];

export const updateArtistValidator = [
  body("name")
    .optional()
    .isString()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Artist name must be between 2 and 100 characters"),

  body("bio")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Bio must not exceed 1000 characters"),

  body("location")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Location must not exceed 100 characters"),

  body("country")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage("Country must not exceed 100 characters"),

  // Presigned upload results (URL or S3 key)
  body("profileImage")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Invalid profile image reference"),

  body("coverImage")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Invalid cover image reference"),

  // Socials
  body("socials")
    .optional()
    .isArray({ max: 10 })
    .withMessage("Socials must be an array of at most 10 items"),

  body("socials.*.platform")
    .if(body("socials").exists())
    .notEmpty()
    .withMessage("Social platform is required")
    .isString()
    .trim()
    .toLowerCase()
    .isIn(ARTIST_SOCIAL_PROVIDERS)
    .withMessage(
      `Social platform must be one of: ${ARTIST_SOCIAL_PROVIDERS.join(", ")}`
    ),

  body("socials.*.url")
    .if(body("socials").exists())
    .notEmpty()
    .withMessage("Social URL is required")
    .isString()
    .trim()
    .isURL({ require_protocol: true })
    .withMessage("Social URL must be a valid URL with protocol (e.g. https://)"),

  // Prevent empty PATCH
  body()
    .custom((value, { req }) => {
      if (!Object.keys(req.body).length) {
        throw new Error("At least one field must be provided for update");
      }
      return true;
    }),
];

export const artistIdValidator = [
  param("id").isMongoId().withMessage("Invalid artist ID"),
];