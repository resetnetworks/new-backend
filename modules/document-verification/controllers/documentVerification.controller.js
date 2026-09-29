import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "crypto";
import DocumentVerification from "../models/DocumentVerification.js";

const s3KycClient = new S3Client({
  region: process.env.AWS_REGION || "ap-south-1",
  requestChecksumCalculation: "WHEN_REQUIRED",
});

export const presignIdentityDocumentUpload = async (req, res) => {
  const { fileName, mimeType, documentType } = req.body;

  if (!fileName || !mimeType || !documentType) {
    return res.status(400).json({ error: "fileName, mimeType, and documentType are required" });
  }

  const validDocumentTypes = ["pan", "aadhaar", "gov_id", "other"];
  if (!validDocumentTypes.includes(documentType)) {
    return res.status(400).json({ error: "Invalid document type" });
  }
  
  const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "application/pdf"];
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return res.status(400).json({ error: "Invalid file type. Only JPEG, PNG, and PDF are allowed." });
  }

  const ext = fileName.split(".").pop().toLowerCase();

  const mimeToExtMap = {
    "image/jpeg": ["jpg", "jpeg"],
    "image/png": ["png"],
    "application/pdf": ["pdf"]
  };

  if (!mimeToExtMap[mimeType]?.includes(ext)) {
    return res.status(400).json({ error: "File extension does not match mime type." });
  }

  const uuid = crypto.randomUUID();
  const key = `document-kyc/${uuid}-${fileName}`;

  const command = new PutObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: key,
    ContentType: mimeType,
    ServerSideEncryption: "aws:kms",
    SSEKMSKeyId: process.env.KMS_KYC_KEY_ID,
    ChecksumAlgorithm: undefined, // Prevent CRC32 from being baked into the signed URL
  });

  const uploadUrl = await getSignedUrl(s3KycClient, command, {
    expiresIn: 300, // 5 minutes
  });
  // console.log("\n\n\n\nUPLOAD URL", uploadUrl, "\n\n\n\n");

  // The SSE-KMS headers are part of the presigned URL signature.
  // S3 requires the browser to send these exact headers during the PUT,
  // or it will return a 403. We return them here so the frontend can include
  // them in the axios.put() call. The KMS Key ID is not sensitive — it is
  // just an ARN identifier; the actual key material never leaves AWS KMS.
  const uploadHeaders = {
    "x-amz-server-side-encryption": "aws:kms",
    "x-amz-server-side-encryption-aws-kms-key-id": process.env.KMS_KYC_KEY_ID,
  };

  // Create a pending record in the database
  const documentRecord = await DocumentVerification.create({
    referenceId: req.user._id || null,
    documentType,
    s3Key: key,
    status: "uploaded",
  });

  res.status(200).json({
    uploadUrl,
    uploadHeaders, // Browser must send these headers in the PUT to satisfy the SSE-KMS signature
    key,
    documentId: documentRecord._id,
  });
};

export const getPresignedViewUrl = async (req, res) => {
  const { referenceId } = req.params;
  // console.log("=====================/n/n/n/n")
  // console.log("========req.params", req.params, req.body)
  // console.log("\n\nDOCUMENTS", req.params, "\n\n");

  const documentRecord = await DocumentVerification.findOne({ referenceId });
  if (!documentRecord) {
    return res.status(404).json({ error: "Document not found" });
  }

  const command = new GetObjectCommand({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: documentRecord.s3Key,
  });

  const viewUrl = await getSignedUrl(s3KycClient, command, {
    expiresIn: 30, // 30 seconds
  });

  // console.log("\nVIEW URL:", viewUrl, "\n")

  res.status(200).json({
    viewUrl,
    expiresIn: 30,
  });
};
