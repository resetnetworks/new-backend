import mongoose from "mongoose";

const migrationAlbumSchema = new mongoose.Schema(
  {
    migrationJobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MigrationJob",
      required: true,
      index: true,
    },
    artistId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MigrationArtist",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    releaseDate: {
      type: Date,
      default: null,
    },
    genres: {
      type: [String],
      default: [],
    },
    coverImage: {
      type: String,
      trim: true,
      default: null,
    },
    sourceUrl: {
      type: String,
      trim: true,
      default: null,
    },
    status: {
      type: String,
      enum: ["DRAFT", "PUBLISHED"],
      default: "DRAFT",
      index: true,
    },
    accessType: {
      type: String,
      enum: ["free", "subscription", "purchase-only"],
      default: "subscription",
    },
    price: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

export const MigrationAlbum =
  mongoose.models.MigrationAlbum || mongoose.model("MigrationAlbum", migrationAlbumSchema);

export default MigrationAlbum;