import mongoose from "mongoose";
import slugify from "slugify";
import { customAlphabet } from "nanoid";

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 6);

/* ===========================
   SUB SCHEMAS
   =========================== */

const priceSchema = new mongoose.Schema(
  {
    currency: {
      type: String,
      required: true,
      uppercase: true,
      minlength: 3,
      maxlength: 3,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

/* ===========================
   ALBUM SCHEMA
   =========================== */

const albumSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },

    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9-]+$/, "Slug must be URL-friendly"],
      index: true,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },

    artist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Artist",
      required: true,
      index: true,
    },

    /* ---------- Media (KEYS ONLY) ---------- */
    coverImageKey: {
      type: String,
      trim: true,
      default: null,
    },

    /* ---------- Metadata ---------- */
    genre: {
      type: [String],
      default: [],
      set: (genres) =>
        Array.isArray(genres)
          ? genres.map((g) => g.trim().toLowerCase()).filter(Boolean)
          : [],
    },

    releaseDate: {
      type: Date,
      default: Date.now,
      index: true,
    },

    songs: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Song",
        required: true,
      },
    ],

    /* ---------- Access & Pricing ---------- */
    accessType: {
      type: String,
      enum: ["free", "subscription", "purchase-only"],
      default: "subscription",
      index: true,
    },

    basePrice: {
      type: priceSchema,
      default: null,
    },

    convertedPrices: {
      type: [priceSchema],
      default: [],
    },

    /* ---------- Soft Delete ---------- */
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },

    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

/* ===========================
   INDEXES
   =========================== */

albumSchema.index({ slug: 1 }, { unique: true });
albumSchema.index({ artist: 1, createdAt: -1 });
albumSchema.index({ accessType: 1, createdAt: -1 });
albumSchema.index({ title: 1 });
albumSchema.index({ songs: 1 });
albumSchema.index({ releaseDate: -1 });
albumSchema.index({ createdAt: -1 });

/* ===========================
   SLUG GENERATION
   =========================== */

albumSchema.pre("validate", function (next) {
  if (this.isModified("title")) {
    const base = slugify(this.title, { lower: true, strict: true });
    this.slug = `${base}-${nanoid()}`;
  }
  next();
});

/* ===========================
   MODEL EXPORT
   =========================== */

export const Album =
  mongoose.models.Album || mongoose.model("Album", albumSchema);

export default Album;
