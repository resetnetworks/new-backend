import mongoose from "mongoose";

const artistBalanceSchema = new mongoose.Schema(
  {
    artistId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Artist",
      unique: true,   // logical guarantee
      required: true,
    },

    totalEarned: {
      type: Number,
      default: 0,
      min: 0,
    },

    availableBalance: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalPaidOut: {
      type: Number,
      default: 0,
      min: 0,
    },

    currency: {
      type: String,
      default: "INR",
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

// 🔑 ONE balance row per artist (O(1) balance fetch)
artistBalanceSchema.index(
  { artistId: 1 },
  { unique: true }
);

// 💸 Admin payout scans (who has money to pay)
artistBalanceSchema.index(
  { availableBalance: -1 }
);

// 📊 Finance & audit dashboards
artistBalanceSchema.index(
  { totalEarned: -1 }
);

// 🧾 Time-based audits & reconciliation
artistBalanceSchema.index(
  { updatedAt: -1 }
);

export const ArtistBalance = mongoose.model(
  "ArtistBalance",
  artistBalanceSchema
);
