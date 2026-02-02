import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";
import { s3 } from "../utils/s3.js";
import { BadRequestError } from "../errors/index.js";


export const presignSongUpload = async (req, res) => {
  const { fileName, mimeType } = req.body;

  if (!mimeType || !mimeType.startsWith("audio/")) {
    throw new BadRequestError("Invalid audio type");
  }

  const ext = fileName.split(".").pop().toLowerCase();
  const key = `songs/${crypto.randomUUID()}.${ext}`;
  const command = new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: key,
    // ACL: "bucket-owner-full-control"
  });
  


  const uploadUrl = await getSignedUrl(s3, command, {
    expiresIn: 300
  });

  res.json({ uploadUrl, key });
};


const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp"
];

export const presignCoverImageUpload = async (req, res) => {
  const { fileName, mimeType } = req.body;

  if (!fileName || !mimeType) {
    throw new BadRequestError("fileName and mimeType are required");
  }

  if (!ALLOWED_IMAGE_MIME_TYPES.includes(mimeType)) {
    throw new BadRequestError("Invalid image type");
  }

  const ext = fileName.split(".").pop().toLowerCase();

  // Extra safety: ensure extension matches mime
  const mimeToExtMap = {
    "image/jpeg": ["jpg", "jpeg"],
    "image/png": ["png"],
    "image/webp": ["webp"]
  };

  if (!mimeToExtMap[mimeType].includes(ext)) {
    throw new BadRequestError("File extension does not match mime type");
  }

  const key = `covers/${crypto.randomUUID()}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: key,
    ContentType: mimeType
  });

  const uploadUrl = await getSignedUrl(s3, command, {
    expiresIn: 300 // 5 minutes
  });

  res.status(200).json({
    uploadUrl,
    key
  });
};

export const presignProfileImageUpload = async (req, res) => {
  const { fileName, mimeType } = req.body;

  if (!fileName || !mimeType) {
    throw new BadRequestError("fileName and mimeType are required");
  }

  if (!ALLOWED_IMAGE_MIME_TYPES.includes(mimeType)) {
    throw new BadRequestError("Invalid image type");
  }

  const ext = fileName.split(".").pop().toLowerCase();

  // Extra safety: ensure extension matches mime
  const mimeToExtMap = {
    "image/jpeg": ["jpg", "jpeg"],
    "image/png": ["png"],
    "image/webp": ["webp"]
  };

  if (!mimeToExtMap[mimeType].includes(ext)) {
    throw new BadRequestError("File extension does not match mime type");
  }

  const key = `artist/${crypto.randomUUID()}.${ext}`;

  const command = new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: key,
    ContentType: mimeType
  });

  const uploadUrl = await getSignedUrl(s3, command, {
    expiresIn: 300 // 5 minutes
  });

  res.status(200).json({
    uploadUrl,
    key
  });
};