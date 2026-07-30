import { v4 as uuidv4 } from "uuid";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3 } from "../../../utils/s3.js";
import { downloadUrlToBuffer } from "../adapters/bandcamp/downloader/bandcampDownloader.js";
import { calculateMd5 } from "../utils/hash.js";
import { migrationAssetRepository } from "../repositories/migrationAsset.repository.js";
import config from "../config.js";

export const downloadAsset = async (migrationJobId, type, originalUrl) => {
  if (!originalUrl) return null;

  try {
    const existingAsset = await migrationAssetRepository.findDownloadedAssetByUrl(originalUrl);
    if (existingAsset && existingAsset.s3Key) {
      const jobAsset = await migrationAssetRepository.findByUrlAndJobId(originalUrl, migrationJobId);
      if (!jobAsset) {
        await migrationAssetRepository.create({
          migrationJobId,
          type,
          originalUrl,
          s3Key: existingAsset.s3Key,
          checksum: existingAsset.checksum,
          status: "DOWNLOADED",
        });
      }
      return existingAsset.s3Key;
    }

    let asset = await migrationAssetRepository.findByUrlAndJobId(originalUrl, migrationJobId);
    if (!asset) {
      asset = await migrationAssetRepository.create({
        migrationJobId,
        type,
        originalUrl,
        status: "PENDING",
      });
    }

    const { buffer, contentType } = await downloadUrlToBuffer(originalUrl);
    const checksum = calculateMd5(buffer);

    let ext = "jpg";
    if (contentType.includes("png")) ext = "png";
    else if (contentType.includes("webp")) ext = "webp";
    else if (contentType.includes("gif")) ext = "gif";

    const s3Key = `covers/${migrationJobId}/${uuidv4()}.${ext}`;

    if (process.env.MOCK_MIGRATION === "true") {
      console.log(`[Mock S3] Uploading file with Key: ${s3Key} (Skipped S3 API Call)`);
    } else {
      const command = new PutObjectCommand({
        Bucket: config.AWS_S3_BUCKET,
        Key: s3Key,
        Body: buffer,
        ContentType: contentType,
      });

      await s3.send(command);
    }

    await migrationAssetRepository.update(asset._id, {
      s3Key,
      checksum,
      status: "DOWNLOADED",
    });

    return s3Key;
  } catch (err) {
    console.error(`[AssetDownloaderService] Failed to download asset ${originalUrl}:`, err.message);
    const asset = await migrationAssetRepository.findByUrlAndJobId(originalUrl, migrationJobId);
    if (asset) {
      await migrationAssetRepository.update(asset._id, {
        status: "FAILED",
      });
    }
    throw err;
  }
};

export const assetDownloaderService = {
  downloadAsset,
};

export default assetDownloaderService;
