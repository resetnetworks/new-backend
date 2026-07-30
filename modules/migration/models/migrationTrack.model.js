import mongoose from "mongoose";

const migrationTrackSchema = new mongoose.Schema(
  {
    migrationAlbumId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MigrationAlbum",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    duration: {
      type: Number,
      default: null,
    },
    trackNumber: {
      type: Number,
      required: true,
    },
    lyrics: {
      type: String,
      default: "",
    },
    credits: {
      type: String,
      default: "",
    },
    audioStatus: {
      type: String,
      enum: ["MISSING", "UPLOADED", "READY"],
      default: "MISSING",
      index: true,
    },
    audioKey: {
      type: String,
      default: null,
      trim: true,
    },
    artwork: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

export const MigrationTrack =
  mongoose.models.MigrationTrack || mongoose.model("MigrationTrack", migrationTrackSchema);

export default MigrationTrack;
