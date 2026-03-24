import mongoose from "mongoose";
import slugify from "slugify";
import { customAlphabet } from "nanoid";

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 6);

const songSchema = new mongoose.Schema(
  {
    /* ======================================================
       CORE IDENTITY
       ====================================================== */

    title: {
      type: String,
      required: true,
      trim: true,
    },

    slug: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9-]+$/, "Slug must be lowercase and URL-friendly"],
    },

    artist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Artist",
      required: true,
      index: true,
    },

    album: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Album",
      default: null,
    },

    /* ======================================================
       CLASSIFICATION & METADATA
       ====================================================== */

    genre: [{
    type: String,
    lowercase: true,
    trim: true
  }],

    isrc: {
      type: String,
      trim: true,
      uppercase: true,
      index: true,
    },

    releaseDate: {
      type: Date,
      default: Date.now,
    },

    /* ======================================================
       MEDIA (AUDIO + IMAGES)
       ====================================================== */

    audioKey: {
      type: String,
      default: "",
      trim: true,
    },

    coverImageKey: {
      type: String,
      default: "",
    },

    duration: {
      type: Number,
      default: 0,
    },

    fileSize: {
      type: Number,
      default: 0,
    },

    /* ======================================================
       PREVIEW & STREAMING STATE
       ====================================================== */

    preview: {
      hlsPath: String, // songs/<songId>/preview/index.m3u8
      duration: Number, // 30
    },

    hlsReady: {
      type: Boolean,
      default: false,
    },

    /* ======================================================
       ACCESS & MONETIZATION
       ====================================================== */

    accessType: {
      type: String,
      enum: ["free", "subscription", "purchase-only"],
      default: "subscription",
    },

    albumOnly: {
      type: Boolean,
      default: false,
    },

    basePrice: {
      currency: { type: String },
      amount: { type: Number },
    },

    convertedPrices: [
      {
        _id: false,
        currency: { type: String },
        amount: { type: Number },
      },
    ],
    artist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    /* ======================================================
       LIFECYCLE / PIPELINE STATUS
       ====================================================== */

    status: {
      type: String,
      enum: ["draft", "uploading", "uploaded", "processing", "ready", "failed"],
      default: "draft",
      index: true,
    },

    /* ======================================================
       SOFT DELETE
       ====================================================== */

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

/* ======================================================
   INDEXES (PRODUCTION CRITICAL)
   ====================================================== */

// 🔑 Public song access (streaming, detail pages)
songSchema.index({ slug: 1 }, { unique: true });

// 🎤 Artist dashboard (songs list, stats)
songSchema.index({ artist: 1, status: 1, createdAt: -1 });

// 💿 Album → songs lookup
songSchema.index({ album: 1, status: 1 });

// 🎧 Discovery & recommendations
songSchema.index({ genre: 1, status: 1 });

// 💰 Monetization filters
songSchema.index({ accessType: 1, status: 1 });

// 🔍 Search & admin tools
songSchema.index({ title: 1 });

// 🧪 Upload / processing monitoring
songSchema.index({ status: 1 });

// 🎼 ISRC lookups (rights / deduplication)
songSchema.index({ isrc: 1 }, { sparse: true });

// 📊 Time-based analytics
songSchema.index({ createdAt: -1 });

/* ======================================================
   SLUG GENERATION
   ====================================================== */

songSchema.pre("validate", function (next) {
  if (!this.slug && this.title) {
    const baseSlug = slugify(this.title, {
      lower: true,
      strict: true,
    });
    this.slug = `${baseSlug}-${nanoid()}`;
  }
  next();
});

export const Song =
  mongoose.models.Song || mongoose.model("Song", songSchema);

