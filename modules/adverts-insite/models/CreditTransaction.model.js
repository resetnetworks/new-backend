import mongoose from "mongoose";

const creditTranscationSchema = mongoose.Schema(
  {
    artistId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Artist",
      required: true,
    },
    walletId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CreditWallet",
      required: true,
    },
    transcationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transcation",
    },
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Campaign",
    },
    type: {
      type: String,
      enum: ["topup", "spend", "refund"],
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    currency: {
      type: String,
      required: true,
      default: "USD"
    },
    balanceAfter: {
      type: Number,
      required: true,
      min: 0,
    },
    description: {
      type: String,
    }
  },
  { timestamps: true }
)


// Indexes for performance on common queries
creditTranscationSchema.index({ walletId: 1, createdAt: -1 });
creditTranscationSchema.index({ artistId: 1, createdAt: -1 });
creditTranscationSchema.index({ campaignId: 1 });

export const CreditTransaction = mongoose.model("CreditTransaction", creditTranscationSchema);