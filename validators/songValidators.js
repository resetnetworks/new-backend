import { body, param } from "express-validator";

const ISRC_REGEX = /^[A-Z]{2}[A-Z0-9]{3}[0-9]{2}[0-9]{5}$/;
const ACCESS_TYPES = ["free", "subscription", "purchase-only"];

export const createSongValidator = [
  /* -------------------- Core -------------------- */
  body("title")
    .trim()
    .notEmpty()
    .withMessage("Title is required"),

  body("duration")
    .isInt({ gt: 0 })
    .withMessage("Duration must be a positive integer"),

  body("audioKey")
  .isString()
  .withMessage("audioKey must be a string")
  .custom((v) => {
    if (!v.startsWith("songs/")) {
      throw new Error("audioKey must start with songs/");
    }
    return true;
  }),


  body("coverImageKey")
  .optional()
  .isString()
  .withMessage("coverImageKey must be a string")
  .custom((v) => {
    if (!v.startsWith("covers/")) {
      throw new Error("coverImageKey must start with covers/");
    }
    return true;
  }),


  /* -------------------- Access -------------------- */
  body("accessType")
    .optional()
    .isIn(ACCESS_TYPES)
    .withMessage("Invalid access type"),

  body("basePrice")
    .optional()
    .custom((v, { req }) => {
      if (typeof v === "string") {
        try {
          v = JSON.parse(v);
          req.body.basePrice = v;
        } catch {
          throw new Error("basePrice must be valid JSON");
        }
      }

      if (
        typeof v !== "object" ||
        v === null ||
        typeof v.amount !== "number" ||
        v.amount <= 0 ||
        !v.currency
      ) {
        throw new Error("Invalid basePrice format");
      }

      return true;
    }),

  /* -------------------- Album -------------------- */
  body("albumOnly")
    .optional()
    .customSanitizer(v => v === "true" || v === true)
    .isBoolean()
    .withMessage("albumOnly must be boolean"),

  body("album")
    .optional()
    .isMongoId()
    .withMessage("Invalid album ID"),

  /* -------------------- Metadata -------------------- */
  body("releaseDate")
    .optional()
    .isISO8601()
    .toDate()
    .withMessage("Invalid release date"),

  body("genre")
    .optional()
    .custom(v => Array.isArray(v) || typeof v === "string")
    .withMessage("Genre must be a string or array"),

body("isrc")
  .optional({ checkFalsy: true })
  .trim()
  .toUpperCase()
  .matches(ISRC_REGEX)
  .withMessage("Invalid ISRC format"),

  /* -------------------- Cross-field rules -------------------- */
  body().custom((_, { req }) => {
    const { accessType, basePrice, albumOnly, album } = req.body;

    if (accessType === "purchase-only" && albumOnly && basePrice) {
      throw new Error("Album-only songs cannot have a price");
    }

    if (accessType === "purchase-only" && !albumOnly && !basePrice) {
      throw new Error("basePrice is required for purchase-only single songs");
    }

    if (accessType !== "purchase-only" && basePrice) {
      throw new Error("Price is only allowed for purchase-only songs");
    }

    if (albumOnly && !album) {
      throw new Error("album is required when albumOnly is true");
    }

    return true;
  })
];

export const updateSongValidator = [
  param("id")
    .isMongoId()
    .withMessage("Invalid song ID"),

  body("title").optional().trim(),

  body("duration")
    .optional()
    .isInt({ gt: 0 })
    .withMessage("Duration must be a positive integer"),

body("audioKey")
  .isString()
  .withMessage("audioKey must be a string")
  .custom((v) => {
    if (!v.startsWith("songs/")) {
      throw new Error("audioKey must start with songs/");
    }
    return true;
  }),


  body("coverImageKey")
  .optional()
  .isString()
  .withMessage("coverImageKey must be a string")
  .custom((v) => {
    if (!v.startsWith("covers/")) {
      throw new Error("coverImageKey must start with covers/");
    }
    return true;
  }),


  body("accessType")
    .optional()
    .isIn(["free", "subscription", "purchase-only"])
    .withMessage("Invalid access type"),

  body("basePrice")
    .optional()
    .custom((v, { req }) => {
      if (typeof v === "string") {
        try {
          v = JSON.parse(v);
          req.body.basePrice = v;
        } catch {
          throw new Error("basePrice must be valid JSON");
        }
      }

      if (
        typeof v !== "object" ||
        typeof v.amount !== "number" ||
        v.amount <= 0 ||
        !v.currency
      ) {
        throw new Error("Invalid basePrice format");
      }

      return true;
    }),

  body("albumOnly")
    .optional()
    .customSanitizer(v => v === "true" || v === true)
    .isBoolean(),

  body("album")
    .optional()
    .isMongoId()
    .withMessage("Invalid album ID"),

  body("releaseDate")
    .optional()
    .isISO8601()
    .toDate(),

  body("genre")
    .optional()
    .custom(v => Array.isArray(v) || typeof v === "string"),

  body("isrc")
    .optional()
    .trim()
    .toUpperCase()
    .matches(ISRC_REGEX),

  /* -------------------- Cross-field rules -------------------- */
  body().custom((_, { req }) => {
    const { accessType, basePrice, albumOnly, album } = req.body;

    if (accessType === "purchase-only" && albumOnly && basePrice) {
      throw new Error("Album-only songs cannot have a price");
    }

    if (accessType === "purchase-only" && !albumOnly && basePrice === undefined) {
      return true; // allowed: price unchanged
    }

    if (accessType !== "purchase-only" && basePrice) {
      throw new Error("Price is only allowed for purchase-only songs");
    }

    if (albumOnly && !album) {
      throw new Error("album is required when albumOnly is true");
    }

    return true;
  })
];

export const songIdValidator = [ param("id").isMongoId().withMessage("Invalid song ID"), ];

