// src/modules/artist/models/artist.model.js
import mongoose from "mongoose";
import slugify from "slugify";
import { customAlphabet } from "nanoid";

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 6);

/* ===========================
   SUB-SCHEMAS
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
      min: [0, "Price cannot be negative"],
    },
  },
  { _id: false }
);

const subscriptionPlanSchema = new mongoose.Schema(
  {
    cycle: {
      type: String,
      enum: ["1m", "3m", "6m", "12m"],
      required: true,
    },

    basePrice: {
      type: priceSchema,
      required: true,
    },

    convertedPrices: {
      type: [priceSchema],
      default: [],
      validate: {
        validator(prices) {
          const currencies = prices.map(p => p.currency);
          return new Set(currencies).size === currencies.length;
        },
        message: "Duplicate converted currencies are not allowed",
      },
    },

    razorpayPlanId: {
      type: String,
      trim: true,
      default: null,
    },

    stripePriceId: {
      type: String,
      trim: true,
      default: null,
    },

    paypalPlans: [
      {
        currency: { type: String, uppercase: true },
        paypalPlanId: { type: String },
      },
    ],

    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const socialSchema = new mongoose.Schema(
  {
    platform: {
      type: String,
      lowercase: true,
      trim: true,
      maxlength: 50,
    },
    url: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    verified: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

/* ===========================
   ARTIST SCHEMA
   =========================== */

const artistSchema = new mongoose.Schema(
  {
    /* ---------- Ownership ---------- */
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    /* ---------- Identity ---------- */
    name: {
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
      unique: true,
      trim: true,
      match: [/^[a-z0-9-]+$/, "Slug must be URL-friendly"],
      index: true,
    },

    /* ---------- Profile ---------- */
    bio: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },

    location: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "",
    },

    country: {
      type: String,
      minlength: 2,
      maxlength: 2,
      uppercase: true,
      trim: true,
      default: null,
      index: true,
    },

    /* ---------- Images (S3 KEYS ONLY) ---------- */
    profileImageKey: {
      type: String,
      trim: true,
      default: null,
    },

    coverImageKey: {
      type: String,
      trim: true,
      default: null,
    },

    socials: {
      type: [socialSchema],
      default: [],
    },

    /* ---------- Contact (Optional / Public) ---------- */
    email: {
      type: String,
      trim: true,
      default: null,
    },

    website: {
      type: String,
      trim: true,
      default: null,
    },

    /* ---------- Monetization ---------- */
    subscriptionPlans: {
      type: [subscriptionPlanSchema],
      default: [],
    },

    monetizationStatus: {
      type: String,
      enum: ["not_set", "pending", "active", "disabled"],
      default: "not_set",
      index: true,
    },

    isMonetizationComplete: {
      type: Boolean,
      default: false,
      index: true,
    },

    monetizationSetupAt: {
      type: Date,
      default: null,
    },

    monetizationSetupBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    monetizationLastSyncAt: {
      type: Date,
      default: null,
    },

    monetizationMetadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    /* ---------- Admin / Control ---------- */
    accountType: {
      type: String,
      enum: ["admin", "self"],
      default: "self",
      index: true,
    },

    approvalStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "approved",
      index: true,
    },

    roles: {
      type: [String],
      default: ["artist"],
      index: true,
    },

    payoutProfileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ArtistPayoutProfile",
      default: null,
      index: true,
    },

    /* ---------- Upload Controls ---------- */
    uploadVersion: {
      type: Number,
      default: 1,
    },

    uploadQuotaBytes: {
      type: Number,
      default: 5 * 1024 * 1024 * 1024, // 5 GB
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
    toJSON: {
      transform(_, ret) {
        ret.id = ret._id;
        delete ret._id;
      },
    },
  }
);

/* ===========================
   INDEXES
   =========================== */

artistSchema.index({ slug: 1 }, { unique: true });
artistSchema.index({ name: 1 });
artistSchema.index({ country: 1, approvalStatus: 1 });
artistSchema.index({ approvalStatus: 1, createdAt: -1 });
artistSchema.index({ monetizationStatus: 1, createdAt: -1 });
artistSchema.index({ createdBy: 1 });
artistSchema.index({ accountType: 1 });
artistSchema.index({ roles: 1 });
artistSchema.index({ payoutProfileId: 1 }, { sparse: true });
artistSchema.index({ createdAt: -1 });

/* ===========================
   SLUG GENERATION
   =========================== */

artistSchema.pre("validate", function (next) {
  if (this.isModified("name")) {
    const base = slugify(this.name, {
      lower: true,
      strict: true,
      trim: true,
    });
    this.slug = `${base}-${nanoid()}`;
  }
  next();
});

/* ===========================
   MODEL EXPORT
   =========================== */

export const Artist =
  mongoose.models.Artist || mongoose.model("Artist", artistSchema);

export default Artist;
