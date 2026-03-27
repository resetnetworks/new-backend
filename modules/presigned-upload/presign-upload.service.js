// services/upload.service.js
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";
import { s3 } from "../../utils/s3.js";
import { BadRequestError } from "../../errors/index.js";

const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/svg+xml",
  "image/heic",
  "image/heif",
  "image/gif",
  "image/bmp",
  "image/tiff"
];

const mimeToExtMap = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"]
};

const getExtension = (fileName) => fileName.split(".").pop().toLowerCase();

const generateUploadUrl = async ({ key, contentType }) => {
  const command = new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: key,
    ...(contentType && { ContentType: contentType })
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });
  return { uploadUrl, key };
};


export const presignSongUploadService = async ({ fileName, mimeType }) => {
  if (!mimeType || !mimeType.startsWith("audio/")) {
    throw new BadRequestError("Invalid audio type");
  }

  const ext = getExtension(fileName);
  const key = `songs/${crypto.randomUUID()}.${ext}`;

  return generateUploadUrl({ key });
};


const validateImage = (fileName, mimeType) => {
  if (!fileName || !mimeType) {
    throw new BadRequestError("fileName and mimeType are required");
  }

  if (!ALLOWED_IMAGE_MIME_TYPES.includes(mimeType)) {
    throw new BadRequestError("Invalid image type");
  }

  const ext = getExtension(fileName);

  if (!mimeToExtMap[mimeType]?.includes(ext)) {
    throw new BadRequestError("File extension does not match mime type");
  }

  return ext;
};


export const presignCoverImageUploadService = async ({ fileName, mimeType }) => {
  const ext = validateImage(fileName, mimeType);
  const key = `covers/${crypto.randomUUID()}.${ext}`;
  return generateUploadUrl({ key, contentType: mimeType });
};


export const presignProfileImageUploadService = async ({ fileName, mimeType }) => {
  const ext = validateImage(fileName, mimeType);
  const key = `artist/${crypto.randomUUID()}.${ext}`;
  return generateUploadUrl({ key, contentType: mimeType });
};