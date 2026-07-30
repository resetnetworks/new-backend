import { body, param } from "express-validator";

export const createBandcampMigrationValidator = [
  body("url")
    .trim()
    .notEmpty().withMessage("URL is required")
    .isURL().withMessage("Must be a valid URL")
    .custom((val) => {
      if (!val.includes("bandcamp.com")) {
        throw new Error("Only Bandcamp artist URLs are supported at this time");
      }
      return true;
    }),
];

export const migrationIdValidator = [
  param("id").isMongoId().withMessage("Invalid migration job ID"),
];
