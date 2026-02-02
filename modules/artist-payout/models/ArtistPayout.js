import mongoose from "mongoose";

const artistPayoutSchema = new mongoose.Schema(
  {
    artistId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Artist",
      required: true,
      index: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 1,
    },

    currency: {
      type: String,
      default: "INR",
    },

    paypalEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    status: {
      type: String,
      enum: ["requested", "paid"],
      default: "requested",
    },

    adminNote: {
      type: String,
    },

    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    processedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

/* ======================================================
   INDEXES (PAYOUT-GRADE)
   ====================================================== */

// 🎤 Artist payout history & dashboard
artistPayoutSchema.index(
  { artistId: 1, createdAt: -1 }
);

// 💸 Admin payout queue (who needs to be paid)
artistPayoutSchema.index(
  { status: 1, createdAt: 1 }
);

// 🧾 Audit & compliance (who paid whom)
artistPayoutSchema.index(
  { processedBy: 1, processedAt: -1 },
  { sparse: true }
);

// 📊 Finance & reconciliation
artistPayoutSchema.index(
  { processedAt: -1 },
  { sparse: true }
);

export const ArtistPayout = mongoose.model(
  "ArtistPayout",
  artistPayoutSchema
);

