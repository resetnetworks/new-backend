import mongoose from "mongoose";
import validator from "validator";

const schema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters long"],
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true, // logical uniqueness
      validate: {
        validator: validator.isEmail,
        message: "Please enter a valid email",
      },
    },

    password: {
      type: String,
      minlength: [8, "Password must be at least 8 characters long"],
      select: false,
      required: function () {
        return !this.googleId;
      },
    },

    googleId: {
      type: String,
    },

    resetPasswordToken: {
      type: String,
    },

    resetPasswordExpire: {
      type: Date,
    },

    dob: {
      type: Date,
    },

    role: {
      type: String,
      enum: ["user", "artist", "artist-pending", "admin"],
      default: "user",
    },

    roleVersion: {
    type: Number,
    default: 1,
  },

    likedsong: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Song",
      },
    ],

    profileImage: {
      type: String,
      default: "",
    },

    preferredGenres: [
      {
        type: String,
        trim: true,
      },
    ],

    artistId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Artist",
      default: null,
    },
  },
  { timestamps: true }
);

/* ======================================================
   INDEXES (PRODUCTION CRITICAL)
   ====================================================== */

// 🔐 Authentication & login
schema.index({ email: 1 }, { unique: true });
schema.index({ googleId: 1 }, { sparse: true });

// 🔑 Password reset flow
schema.index({ resetPasswordToken: 1 }, { sparse: true });
schema.index({ resetPasswordExpire: 1 });

// 🧑‍💼 Role-based queries (admin panels, moderation)
schema.index({ role: 1 });

// 🎤 Artist linkage (user → artist profile)
schema.index({ artistId: 1 }, { sparse: true });

// ❤️ Liked songs reverse lookup (analytics / artist insights)
schema.index({ likedsong: 1 });

// 🎵 Recommendation & discovery
schema.index({ preferredGenres: 1 });

// 📊 Time-based analytics
schema.index({ createdAt: -1 });

export const User = mongoose.model("User", schema);
