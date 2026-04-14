import mongoose from "mongoose";

const playlistSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    songs: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Song",
      },
    ],

    isPublic: {
      type: Boolean,
      default: false,
      index: true,
    },

  },
  { timestamps: true }
);

// ----------------------
// Indexes
// ----------------------
playlistSchema.index({ createdBy: 1, createdAt: -1 });

// ----------------------
// Virtuals
// ----------------------
playlistSchema.virtual("songCount").get(function () {
  return this.songs?.length || 0;
});

// ----------------------
// Transform
// ----------------------
playlistSchema.set("toJSON", {
  virtuals: true,
  versionKey: false,
  transform: (_, ret) => {
    ret.id = ret._id;
    delete ret._id;
  },
});

export const Playlist = mongoose.model("Playlist", playlistSchema);

