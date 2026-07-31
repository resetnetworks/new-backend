import mongoose from "mongoose";

const creditWalletSchema = mongoose.Schema(
  {
    artistId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Artist",
      required: true,
    },
    balance: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalPurchased: {
      type: Number,
      default: 0
    },
    totalSpent: {
      type: Number,
      default: 0
    }
  },
  { timestamps: true }
)

// Index
creditWalletSchema.index({ artistId: 1 }, { unique: true });


export const CreditWallet = mongoose.model("CreditWallet", creditWalletSchema);
