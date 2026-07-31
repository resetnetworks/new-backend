import mongoose from "mongoose";
import Artist from "../../artist/models/artist.model.js";

const campaignSchema = mongoose.Schema(
  {
    artistId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Artist",
      required: true,
    },
    campaignName: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 150,
    },
    promotionType: {
      type: String,
      enum: ["Song", "Album"],
      required: true,
    },
    promotionId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "promotionType",
      required: true,
    },
    status: {
      type: String,
      enum: ["draft", "scheduled", "active", "paused", "completed", "ended"],
      default: "draft",
    },
    budget: {
      type: Number,
      required: true,
      min: 10,
    },
    spent: {
      type: Number,
      default: 0,
      min: 0,
    },
    placement: {
      type: String,
      enum: ["all", "home", "search", "editorial"],
      default: "all",
      required: true,
    },
    startDate: {
      type: Date,
      required: true,
      default: Date.now(),
    },
    endDate: {
      type: Date,
      required: true,
      validate: {
        validator: function (value) {
          if (!this.startDate) return false;

          const diff = value.getTime() - this.startDate.getTime();

          return diff >= 24 * 60 * 60 * 1000; // 24 hours
        },
        message: 'End date must be at least 24 hours after the start date.',
      },
    },
    completedReason: {
      type: String,
      enum: ["budget_exhausted", "duration_ended", "ended_by_artist"],
    },
  },
  { timestamps: true }
)

// indexes
campaignSchema.index(
  { artistId: 1, campaignName: 1 },
  { unique: true }
);
campaignSchema.index({ artistId: 1 });
campaignSchema.index({ status: 1 });
campaignSchema.index({ startDate: 1, endDate: -1 });
campaignSchema.index({ createdAt: -1 });

export const Campaign = mongoose.model("Campaign", campaignSchema);