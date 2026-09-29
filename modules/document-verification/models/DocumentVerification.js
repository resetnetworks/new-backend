import mongoose from "mongoose";

const documentVerificationSchema = new mongoose.Schema(
  {
    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    documentType: {
      type: String,
      enum: ["pan", "aadhaar", "gov_id", "other"],
      required: true,
    },
    s3Key: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["uploaded", "verified", "rejected"],
      default: "uploaded",
    },
  },
  { timestamps: true }
);

export default mongoose.model("DocumentVerification", documentVerificationSchema);
