import mongoose from "mongoose";

const migrationSourceSchema = new mongoose.Schema(
  {
    migrationJobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MigrationJob",
      required: true,
      index: true,
    },
    source: {
      type: String,
      required: true,
      trim: true,
    },
    rawData: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    scrapedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

export const MigrationSource =
  mongoose.models.MigrationSource || mongoose.model("MigrationSource", migrationSourceSchema);

export default MigrationSource;
