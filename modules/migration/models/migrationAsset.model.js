import mongoose from "mongoose";

const migrationAssetSchema = new mongoose.Schema(
  {
    migrationJobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MigrationJob",
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: ["artist_image", "album_cover"],
    },
    originalUrl: {
      type: String,
      required: true,
      trim: true,
    },
    s3Key: {
      type: String,
      default: null,
    },
    checksum: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ["PENDING", "DOWNLOADED", "FAILED"],
      default: "PENDING",
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

export const MigrationAsset =
  mongoose.models.MigrationAsset || mongoose.model("MigrationAsset", migrationAssetSchema);

export default MigrationAsset;
