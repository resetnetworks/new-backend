import { body, param } from "express-validator";

export const createBandcampMigrationValidator = [
  body("url")
    .trim()
    .notEmpty().withMessage("URL is required")
    .isURL().withMessage("Must be a valid URL")
    .custom((val) => {
      if (!val.includes("bandcamp.com") && !val.includes("spotify.com")) {
        throw new Error("Only Bandcamp or Spotify artist URLs are supported");
      }
      return true;
    }),
];

export const migrationIdValidator = [
  param("id").isMongoId().withMessage("Invalid migration job ID"),
];
