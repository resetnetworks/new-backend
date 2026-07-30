import { Worker } from "bullmq";
import { redisConnection } from "../../../queue/connection.js";
import { migrationJobRepository } from "../repositories/migrationJob.repository.js";
import { migrationSourceRepository } from "../repositories/migrationSource.repository.js";
import { migrationArtistRepository } from "../repositories/migrationArtist.repository.js";
import { migrationAlbumRepository } from "../repositories/migrationAlbum.repository.js";
import { migrationTrackRepository } from "../repositories/migrationTrack.repository.js";
import { bandcampScraperService } from "../services/scraper.service.js";
import { bandcampParserService } from "../services/parser.service.js";
import { bandcampNormalizerService } from "../services/normalizer.service.js";
import { migrationPersistenceService } from "../services/persistence.service.js";
import { assetDownloaderService } from "../services/downloader.service.js";
import { migrationQueue } from "../jobs/migration.queue.js";

const CONCURRENCY = 1;

export const migrationWorker = new Worker(
  "migrationQueue",
  async (job) => {
    const { jobId, step } = job.data;
    console.log(`[MigrationWorker] Processing Job ${jobId} at step: ${step}`);

    const dbJob = await migrationJobRepository.findById(jobId);
    if (!dbJob) {
      throw new Error(`Migration job ${jobId} not found in database`);
    }

    if (dbJob.status === "FAILED" && dbJob.currentStep === "CANCELLED") {
      console.log(`[MigrationWorker] Job ${jobId} is cancelled. Skipping.`);
      return;
    }

    try {
      if (step === "scrape") {
        await migrationJobRepository.updateStatus(jobId, "SCRAPING", 10, "Scraping Bandcamp pages");

        const rawData = await bandcampScraperService.scrapeArtist(dbJob.sourceUrl);

        await migrationSourceRepository.create({
          migrationJobId: jobId,
          source: dbJob.source,
          rawData,
        });

        await migrationQueue.add("process-migration", { jobId, step: "normalize" });
      } else if (step === "normalize") {
        await migrationJobRepository.updateStatus(jobId, "NORMALIZING", 40, "Normalizing scraped metadata");

        const sourceData = await migrationSourceRepository.findByJobId(jobId);
        if (!sourceData) throw new Error("No raw scrape data found to normalize");

        const parsed = bandcampParserService.parseData(sourceData.rawData);
        const normalized = bandcampNormalizerService.normalize(parsed, jobId);

        await migrationPersistenceService.saveNormalizedData(jobId, normalized);

        await migrationQueue.add("process-migration", { jobId, step: "download-assets" });
      } else if (step === "download-assets") {
        await migrationJobRepository.updateStatus(jobId, "DOWNLOADING_ASSETS", 70, "Downloading image covers & avatars");

        const artist = await migrationArtistRepository.findByJobId(jobId);
        let assetsCount = 0;
        let failedAssetsCount = 0;

        if (artist && artist.image && !artist.image.startsWith("covers/")) {
          try {
            const s3Key = await assetDownloaderService.downloadAsset(jobId, "artist_image", artist.image);
            if (s3Key) {
              artist.image = s3Key;
              await artist.save();
              assetsCount++;
            }
          } catch (err) {
            console.error(`[MigrationWorker] Failed artist image download: ${err.message}`);
            failedAssetsCount++;
          }
        }

        const albums = await migrationAlbumRepository.findByJobId(jobId);
        let tracksCount = 0;

        for (const album of albums) {
          if (album.coverImage && !album.coverImage.startsWith("covers/")) {
            try {
              const s3Key = await assetDownloaderService.downloadAsset(jobId, "album_cover", album.coverImage);
              if (s3Key) {
                album.coverImage = s3Key;
                await album.save();
                assetsCount++;

                await import("../models/migrationTrack.model.js").then(async ({ MigrationTrack }) => {
                  await MigrationTrack.updateMany(
                    { migrationAlbumId: album._id },
                    { $set: { artwork: s3Key } }
                  );
                });
              }
            } catch (err) {
              console.error(`[MigrationWorker] Failed album cover download: ${err.message}`);
              failedAssetsCount++;
            }
          }

          const mtracks = await migrationTrackRepository.findByAlbumId(album._id);
          tracksCount += mtracks.length;
        }

        await migrationJobRepository.update(jobId, {
          statistics: {
            albumsCount: albums.length,
            tracksCount,
            assetsCount,
            failedAlbumsCount: 0,
            failedAssetsCount,
          },
        });

        await migrationQueue.add("process-migration", { jobId, step: "finalize" });
      } else if (step === "finalize") {
        await migrationJobRepository.updateStatus(jobId, "READY", 100, "Ready for Import");
      }
    } catch (err) {
      console.error(`[MigrationWorker] Job ${jobId} failed at step ${step}:`, err.message);
      await migrationJobRepository.updateStatus(jobId, "FAILED", dbJob.progress, `FAILED: ${step}`, err.message);
      throw err;
    }
  },
  {
    connection: redisConnection,
    concurrency: CONCURRENCY,
  }
);

migrationWorker.on("failed", (job, err) => {
  console.error(`[MigrationWorker] BullMQ Job ${job?.id} failed:`, err.message);
});

export default migrationWorker;
