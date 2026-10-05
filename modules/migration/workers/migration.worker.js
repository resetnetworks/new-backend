import { Worker } from "bullmq";
import { redisConnection } from "../../../queue/connection.js";
import { migrationJobRepository } from "../repositories/migrationJob.repository.js";
import { migrationSourceRepository } from "../repositories/migrationSource.repository.js";
import { migrationArtistRepository } from "../repositories/migrationArtist.repository.js";
import { migrationAlbumRepository } from "../repositories/migrationAlbum.repository.js";
import { migrationTrackRepository } from "../repositories/migrationTrack.repository.js";
import { discoverArtistAlbums, scrapeSingleAlbum } from "../adapters/bandcamp/scraper/bandcampScraper.js";
import { parseArtistHtml, parseAlbumHtml } from "../adapters/bandcamp/parser/bandcampParser.js";
import { normalizeData as normalizeBandcampData } from "../adapters/bandcamp/normalizer/bandcampNormalizer.js";
import { assetDownloaderService } from "../services/downloader.service.js";
import { migrationQueue } from "../jobs/migration.queue.js";

// Spotify imports
import { scrapeArtistPage, scrapeAlbumPage } from "../adapters/spotify/spotifyClient.js";
import { normalizeSpotifyData } from "../adapters/spotify/spotifyNormalizer.js";

const CONCURRENCY = 2;

export const migrationWorker = new Worker(
  "migrationQueue",
  async (job) => {
    const { jobId, step, albumUrl, index, total } = job.data;
    console.log(`[MigrationWorker] Processing Job ${jobId} at step: ${step}${albumUrl ? ` (${albumUrl})` : ""}`);

    const dbJob = await migrationJobRepository.findById(jobId);
    if (!dbJob) {
      throw new Error(`Migration job ${jobId} not found in database`);
    }

    if (dbJob.status === "FAILED" && dbJob.currentStep === "CANCELLED") {
      console.log(`[MigrationWorker] Job ${jobId} is cancelled. Skipping.`);
      return;
    }

    try {
      if (step === "discover" || step === "scrape") {
        await migrationJobRepository.updateStatus(jobId, "SCRAPING", 10, "Discovering artist discography");
        const isSpotify = dbJob.source === "spotify" || dbJob.sourceUrl.includes("spotify.com");

        let artistInfo = { name: "Unknown Artist", bio: "", image: null };
        let albumUrls = [];

        if (isSpotify) {
          const spotifyArtist = await scrapeArtistPage(dbJob.sourceUrl);
          artistInfo = {
            name: spotifyArtist.name,
            bio: spotifyArtist.bio,
            image: spotifyArtist.image,
          };
          albumUrls = spotifyArtist.albumUrls || [];
        } else {
          const discovery = await discoverArtistAlbums(dbJob.sourceUrl);
          const parsedArtist = parseArtistHtml(discovery.artistHtml);
          artistInfo = {
            name: parsedArtist.name || "Unknown Artist",
            bio: parsedArtist.bio || "",
            image: parsedArtist.image || null,
            genres: parsedArtist.genres || [],
            location: parsedArtist.location || null,
          };
          albumUrls = discovery.albumUrls || [];
        }

        // Save normalized artist record immediately
        let artistRecord = await migrationArtistRepository.findByJobId(jobId);
        if (artistRecord) {
          artistRecord = await migrationArtistRepository.updateByJobId(jobId, { migrationJobId: jobId, ...artistInfo });
        } else {
          artistRecord = await migrationArtistRepository.create({ migrationJobId: jobId, ...artistInfo });
        }

        // Save raw discovery data
        await migrationSourceRepository.create({
          migrationJobId: jobId,
          source: dbJob.source,
          rawData: { artist: artistInfo, albumUrls },
        });

        if (albumUrls.length === 0) {
          await migrationJobRepository.updateStatus(jobId, "READY", 100, "Ready for Import (0 albums found)");
          return;
        }

        // Initialize statistics
        await migrationJobRepository.update(jobId, {
          statistics: {
            albumsCount: 0,
            tracksCount: 0,
            assetsCount: 0,
            failedAlbumsCount: 0,
            failedAssetsCount: 0,
          },
        });

        // Fan-out individual album scraping jobs into BullMQ
        console.log(`[MigrationWorker] Discovered ${albumUrls.length} albums for Job ${jobId}. Enqueuing queue jobs...`);
        for (let i = 0; i < albumUrls.length; i++) {
          await migrationQueue.add("process-migration", {
            jobId,
            step: "scrape-album",
            albumUrl: albumUrls[i],
            index: i,
            total: albumUrls.length,
          });
        }

        await migrationJobRepository.updateStatus(jobId, "SCRAPING", 15, `Queued ${albumUrls.length} album tasks`);
      } else if (step === "scrape-album") {
        const isSpotify = dbJob.source === "spotify" || dbJob.sourceUrl.includes("spotify.com");
        const artistRecord = await migrationArtistRepository.findByJobId(jobId);

        let parsedAlbum;
        if (isSpotify) {
          const rawAlbum = await scrapeAlbumPage(albumUrl);
          const normalized = normalizeSpotifyData({ artist: artistRecord, albums: [rawAlbum] }, jobId);
          parsedAlbum = normalized.albums[0];
        } else {
          const rawAlbum = await scrapeSingleAlbum(albumUrl, dbJob.sourceUrl);
          const parsed = parseAlbumHtml(rawAlbum.html, albumUrl);
          const normalized = normalizeBandcampData({ artist: artistRecord, albums: [parsed] }, jobId);
          parsedAlbum = normalized.albums[0];
        }

        if (parsedAlbum) {
          // Download cover artwork asset if available
          let s3CoverKey = parsedAlbum.coverImage;
          if (parsedAlbum.coverImage && !parsedAlbum.coverImage.startsWith("covers/")) {
            try {
              const downloadedKey = await assetDownloaderService.downloadAsset(jobId, "album_cover", parsedAlbum.coverImage);
              if (downloadedKey) s3CoverKey = downloadedKey;
            } catch (err) {
              console.error(`[MigrationWorker] Cover image download error for ${albumUrl}:`, err.message);
            }
          }

          // Persist MigrationAlbum record
          const albumRecord = await migrationAlbumRepository.create({
            migrationJobId: jobId,
            artistId: artistRecord ? artistRecord._id : null,
            title: parsedAlbum.title,
            description: parsedAlbum.description,
            releaseDate: parsedAlbum.releaseDate,
            genres: parsedAlbum.genres,
            coverImage: s3CoverKey,
            sourceUrl: albumUrl,
          });

          // Persist MigrationTrack records
          let trackCount = 0;
          for (const track of parsedAlbum.tracks || []) {
            await migrationTrackRepository.create({
              migrationAlbumId: albumRecord._id,
              title: track.title,
              duration: track.duration,
              trackNumber: track.trackNumber,
              lyrics: track.lyrics,
              credits: track.credits,
              audioStatus: track.audioStatus,
              audioKey: track.audioKey || track.audioUrl || null,
              artwork: s3CoverKey,
            });
            trackCount++;
          }

          // Update statistics atomically
          await migrationJobRepository.updateStatistics(jobId, {
            albumsCount: 1,
            tracksCount: trackCount,
            assetsCount: s3CoverKey && s3CoverKey.startsWith("covers/") ? 1 : 0,
          });
        }

        // Calculate progress percentage atomically (15% -> 95%)
        const currentProgress = Math.min(95, 15 + Math.round(((index + 1) / total) * 80));
        await migrationJobRepository.updateStatus(
          jobId,
          currentProgress >= 90 ? "NORMALIZING" : "SCRAPING",
          currentProgress,
          `Ingested album (${index + 1}/${total})`
        );

        // If all albums in discography are processed, enqueue finalize job
        if (index + 1 === total) {
          await migrationQueue.add("process-migration", { jobId, step: "finalize" });
        }
      } else if (step === "download-assets") {
        await migrationJobRepository.updateStatus(jobId, "DOWNLOADING_ASSETS", 90, "Downloading avatar assets");

        const artist = await migrationArtistRepository.findByJobId(jobId);
        if (artist && artist.image && !artist.image.startsWith("covers/")) {
          try {
            const s3Key = await assetDownloaderService.downloadAsset(jobId, "artist_image", artist.image);
            if (s3Key) {
              artist.image = s3Key;
              await artist.save();
              await migrationJobRepository.updateStatistics(jobId, { assetsCount: 1 });
            }
          } catch (err) {
            console.error(`[MigrationWorker] Failed artist image download: ${err.message}`);
          }
        }

        await migrationQueue.add("process-migration", { jobId, step: "finalize" });
      } else if (step === "finalize") {
        // Download artist image if not done yet
        const artist = await migrationArtistRepository.findByJobId(jobId);
        if (artist && artist.image && !artist.image.startsWith("covers/")) {
          try {
            const s3Key = await assetDownloaderService.downloadAsset(jobId, "artist_image", artist.image);
            if (s3Key) {
              artist.image = s3Key;
              await artist.save();
              await migrationJobRepository.updateStatistics(jobId, { assetsCount: 1 });
            }
          } catch (err) {
            console.error(`[MigrationWorker] Final artist image download error: ${err.message}`);
          }
        }

        await migrationJobRepository.updateStatus(jobId, "READY", 100, "Ready for Import");
      }
    } catch (err) {
      console.error(`[MigrationWorker] Job ${jobId} failed at step ${step}:`, err.message);
      if (step === "discover" || step === "scrape" || step === "finalize") {
        await migrationJobRepository.updateStatus(jobId, "FAILED", dbJob.progress, `FAILED: ${step}`, err.message);
      }
      throw err;
    }
  },
  {
    connection: redisConnection,
    concurrency: CONCURRENCY,
    limiter: {
      max: 5,
      duration: 10000,
    },
  }
);

migrationWorker.on("failed", (job, err) => {
  console.error(`[MigrationWorker] BullMQ Job ${job?.id} failed (Step: ${job?.data?.step}):`, err.message);
});

export default migrationWorker;
