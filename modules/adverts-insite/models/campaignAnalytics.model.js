import mongoose from "mongoose";

const campaignAnalyticsSchema = mongoose.Schema(
  {
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Campaign",
      required: true,
    },
    impressions: {
      type: Number,
      default: 0,
      min: 0,
    },
    clicks: {
      type: Number,
      default: 0,
      min: 0,
    },
    plays: {
      type: Number,
      default: 0,
      min: 0,
    },
    purchases: {
      type: Number,
      default: 0,
      min: 0,
    },
    ctr: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastUpdated: {
      type: Date,
      default: Date.now(),
    },
  },
  { timestamps: true }
)

// Indexes for performance on common queries
campaignAnalyticsSchema.index({ campaignId: 1 }, { unique: true });
campaignAnalyticsSchema.index({ createdAt: -1 });


export const CampaignAnalytics = mongoose.model("CampaignAnalytics", campaignAnalyticsSchema);