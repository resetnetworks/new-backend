import mongoose from "mongoose";

const migrationJobSchema = new mongoose.Schema(
  {
    source: {
      type: String,
      required: true,
      trim: true,
    },
    sourceUrl: {
      type: String,
      required: true,
      trim: true,
    },
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Workspace",
      required: false,
      index: true,
    },
    status: {
      type: String,
      enum: [
        "PENDING",
        "SCRAPING",
        "NORMALIZING",
        "DOWNLOADING_ASSETS",
        "READY",
        "FAILED",
        "IMPORTED",
      ],
      default: "PENDING",
      index: true,
    },
    progress: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    currentStep: {
      type: String,
      default: "PENDING",
    },
    startedAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    error: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    statistics: {
      type: mongoose.Schema.Types.Mixed,
      default: {
        albumsCount: 0,
        tracksCount: 0,
        assetsCount: 0,
        failedAlbumsCount: 0,
        failedAssetsCount: 0,
      },
    },
    retries: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

export const MigrationJob =
  mongoose.models.MigrationJob || mongoose.model("MigrationJob", migrationJobSchema);

export default MigrationJob;
