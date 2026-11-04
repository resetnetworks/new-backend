import mongoose from "mongoose";
import { REFERRAL_STATUS } from "../config/referral.constants.js";

// Stage 1: Referral code applied during application submission
const stage1CodeAppliedSchema = new mongoose.Schema(
  {
    status: {
      type: Boolean,
      default: true,
    },
    completedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

// Stage 2: Admin reviews and approves the referee's artist profile
const stage2ArtistApprovedSchema = new mongoose.Schema(
  {
    status: {
      type: Boolean,
      default: false,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

// Stage 3: Referee uploads their first song or album (Qualifies the referral)
const stage3ContentUploadedSchema = new mongoose.Schema(
  {
    status: {
      type: Boolean,
      default: false,
    },
    contentId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    contentType: {
      type: String,
      enum: ["song", "album", null],
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

// Stage 4: Admin reviews and approves the uploaded content (auto-completed for now)
const stage4ContentApprovedSchema = new mongoose.Schema(
  {
    status: {
      type: Boolean,
      default: false,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const artistReferralSchema = new mongoose.Schema(
  {
    /* ---------- Referrer (The one who shared the code) ---------- */
    referrerArtistId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Artist",
      required: true,
      index: true,
    },

    referrerUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    /* ---------- Referee (The applicant/artist who used the code) ---------- */
    refereeUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // A user can only be referred once
      index: true,
    },

    refereeApplicationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ArtistApplication",
      default: null,
      index: true,
    },

    refereeArtistId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Artist",
      default: null,
      index: true,
    },

    /* ---------- Referral Code Info ---------- */
    referralCode: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },

    /* ---------- 4 Progression Stages ---------- */
    stage1_codeApplied: {
      type: stage1CodeAppliedSchema,
      default: () => ({ status: true, completedAt: new Date() }),
    },

    stage2_artistApproved: {
      type: stage2ArtistApprovedSchema,
      default: () => ({}),
    },

    stage3_contentUploaded: {
      type: stage3ContentUploadedSchema,
      default: () => ({}),
    },

    stage4_contentApproved: {
      type: stage4ContentApprovedSchema,
      default: () => ({}),
    },

    /* ---------- Overall Status ---------- */
    status: {
      type: String,
      enum: Object.values(REFERRAL_STATUS),
      default: REFERRAL_STATUS.IN_PROGRESS,
      index: true,
    },

    /* ---------- Reward Tracking (Every 3 Qualified = $10 USD) ---------- */
    isRewarded: {
      type: Boolean,
      default: false,
      index: true,
    },

    rewardedAt: {
      type: Date,
      default: null,
    },

    rewardBatchId: {
      type: mongoose.Schema.Types.ObjectId,
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
artistReferralSchema.index({ referrerArtistId: 1, status: 1, isRewarded: 1 });
artistReferralSchema.index({ referralCode: 1, createdAt: -1 });

export const ArtistReferral =
  mongoose.models.ArtistReferral ||
  mongoose.model("ArtistReferral", artistReferralSchema);

export default ArtistReferral;
