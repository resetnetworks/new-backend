import mongoose from "mongoose";

const artistLedgerSchema = new mongoose.Schema(
  {
    artistId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Artist",
      required: true,
      // index: true,
    },

    type: {
      type: String,
      enum: ["credit", "debit"],
      required: true,
    },

    source: {
      type: String,
      enum: ["song", "album", "subscription", "payout"],
      required: true,
    },

    refId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    amountUSD: {
      type: Number,
      min: 0,
    },

    grossAmount: {
      type: Number,
      min: 0,
    },

    grossAmountUSD: {
      type: Number,
      min: 0,
    },

    currency: {
      type: String,
      default: "INR",
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  }
);

/* ======================================================
   INDEXES (FINANCIAL-GRADE)
   ====================================================== */

/**
 * 🔒 STRONG IDEMPOTENCY
 * - One transaction → one credit
 * - One payout → one debit
 */
artistLedgerSchema.index(
  { type: 1, refId: 1 },
  { unique: true }
);

// 🎤 Artist earnings timeline (dashboards, audits)
artistLedgerSchema.index(
  { artistId: 1, createdAt: -1 }
);

// 💰 Balance aggregation helpers (rare, but safe)
artistLedgerSchema.index(
  { artistId: 1, type: 1 }
);

// 🧾 Source-based audits (song / album / subscription / payout)
artistLedgerSchema.index(
  { source: 1, createdAt: -1 }
);

// 📊 Finance & reconciliation jobs
artistLedgerSchema.index(
  { createdAt: -1 }
);

export const ArtistLedger = mongoose.model(
  "ArtistLedger",
  artistLedgerSchema
);