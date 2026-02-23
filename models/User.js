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

    // 🔁 Refresh token auth
    refreshToken: {
      type: String,
      select: false,
    },

    refreshTokenExpire: {
      type: Date,
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

    // likedsong: [
    //   {
    //     type: mongoose.Schema.Types.ObjectId,
    //     ref: "LikedSong",
    //   },
    // ],

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
    
    purchaseHistory: [
      {
        _id: false,
        transactionId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Transaction",
          required: true,
        },
        itemType: {
          type: String,
          enum: ["song", "album", "artist-subscription"],
          required: true,
        },
      },
    ],

  },
  { timestamps: true }
);

/* ======================================================
   INDEXES (PRODUCTION CRITICAL)
   ====================================================== */

// 🔐 Authentication & login
schema.index({ email: 1 }, { unique: true });
schema.index({ googleId: 1 }, { sparse: true });

// 🔁 Refresh token flow
schema.index({ refreshToken: 1 }, { sparse: true });
schema.index({ refreshTokenExpire: 1 });

// 🔑 Password reset flow
schema.index({ resetPasswordToken: 1 }, { sparse: true });
schema.index({ resetPasswordExpire: 1 });

// 🧑‍💼 Role-based queries (admin panels, moderation)
schema.index({ role: 1 });

// 🎤 Artist linkage (user → artist profile)
schema.index({ artistId: 1 }, { sparse: true });

// ❤️ Liked songs reverse lookup (analytics / artist insights)
// schema.index({ likedsong: 1 });  -- removed this cause of new LikedSong model + unbouned Array problem

// 🎵 Recommendation & discovery
schema.index({ preferredGenres: 1 });

// 📊 Time-based analytics
schema.index({ createdAt: -1 });

export const User = mongoose.model("User", schema);
