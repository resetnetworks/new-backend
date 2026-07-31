import mongoose from "mongoose";

const campaignEventSchema = mongoose.Schema(
  {
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Campaign",
      required: true,
    },
    artistId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Artist",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    eventType: {
      type: String,
      enum: ["impression", "click", "play", "purchase"],
      required: true,
    },
    songId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Song",
    },
    albumId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Album",
    },
  },
  { timestamps: true }
);

// Indexes for performance on common queries
campaignEventSchema.index({ campaignId: 1, eventType: 1 });
campaignEventSchema.index({ artistId: 1 });
campaignEventSchema.index({ createdAt: -1 });

export const CampaignEvent = mongoose.model("CampaignEvent", campaignEventSchema);