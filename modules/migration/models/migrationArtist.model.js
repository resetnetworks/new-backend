import mongoose from "mongoose";

const migrationArtistSchema = new mongoose.Schema(
  {
    migrationJobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MigrationJob",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    bio: {
      type: String,
      trim: true,
      default: "",
    },
    image: {
      type: String,
      trim: true,
      default: null,
    },
    genres: {
      type: [String],
      default: [],
    },
    location: {
      type: String,
      trim: true,
      default: null,
    },
    website: {
      type: String,
      trim: true,
      default: null,
    },
    socialLinks: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

export const MigrationArtist =
  mongoose.models.MigrationArtist || mongoose.model("MigrationArtist", migrationArtistSchema);

export default MigrationArtist;
