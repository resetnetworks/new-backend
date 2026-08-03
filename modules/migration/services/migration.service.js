import mongoose from "mongoose";
import { migrationJobRepository } from "../repositories/migrationJob.repository.js";
import { migrationArtistRepository } from "../repositories/migrationArtist.repository.js";
import { migrationAlbumRepository } from "../repositories/migrationAlbum.repository.js";
import { migrationTrackRepository } from "../repositories/migrationTrack.repository.js";
import { migrationQueue } from "../jobs/migration.queue.js";

// Production Models local references
import { Artist } from "../../artist/models/artist.model.js";
import { Album } from "../../../models/album.model.js";
import { Song } from "../../../models/song.model.js";
import { Workspace } from "../../workspace/workspace.model.js";
import config from "../config.js";




export const createMigration = async (workspaceId, url, source = "bandcamp") => {
  const duplicate = await migrationJobRepository.findDuplicate(url, workspaceId);
  if (duplicate) {
    throw new Error(`A migration job for URL ${url} is already in progress (Status: ${duplicate.status})`);
  }

  const job = await migrationJobRepository.create({
    source,
    sourceUrl: url,
    workspaceId,
    status: "PENDING",
    progress: 0,
    currentStep: "PENDING",
  });

  await migrationQueue.add("process-migration", { jobId: job._id.toString(), step: "scrape" });

  return job;
};

export const startMigration = async (jobId) => {
  const job = await migrationJobRepository.findById(jobId);
  if (!job) throw new Error("Migration job not found");

  await migrationJobRepository.updateStatus(jobId, "PENDING", 0, "QUEUED");
  await migrationQueue.add("process-migration", { jobId: jobId.toString(), step: "scrape" });

  return job;
};

export const retryMigration = async (jobId) => {
  const job = await migrationJobRepository.findById(jobId);
  if (!job) throw new Error("Migration job not found");

  await migrationJobRepository.incrementRetries(jobId);
  await migrationJobRepository.updateStatus(jobId, "PENDING", 0, "RETRIED");
  await migrationQueue.add("process-migration", { jobId: jobId.toString(), step: "scrape" });

  return job;
};

export const cancelMigration = async (jobId) => {
  const job = await migrationJobRepository.findById(jobId);
  if (!job) throw new Error("Migration job not found");

  if (["READY", "FAILED", "IMPORTED"].includes(job.status)) {
    throw new Error(`Cannot cancel a job with status ${job.status}`);
  }

  const updatedJob = await migrationJobRepository.updateStatus(
    jobId,
    "FAILED",
    job.progress,
    "CANCELLED",
    "Migration job was cancelled by user"
  );

  return updatedJob;
};

export const importMigration = async (jobId, userId) => {
  const job = await migrationJobRepository.findById(jobId);
  if (!job) throw new Error("Migration job not found");
  if (job.status !== "READY") {
    throw new Error(`Only READY jobs can be imported. Current status: ${job.status}`);
  }

  const migrationArtist = await migrationArtistRepository.findByJobId(jobId);
  if (!migrationArtist) throw new Error("No normalized artist found for this job");

  const migrationAlbums = await migrationAlbumRepository.findByJobId(jobId);

  const session = await mongooseBackend.startSession();
  session.startTransaction();

  try {
    let artistId;
    let workspaceDoc;

    if (job.workspaceId) {
      workspaceDoc = await Workspace.findById(job.workspaceId).session(session);
    }

    if (workspaceDoc && workspaceDoc.artistId) {
      artistId = workspaceDoc.artistId;
      const existingArtist = await Artist.findById(artistId).session(session);
      if (existingArtist) {
        let needsSave = false;
        if (!existingArtist.bio && migrationArtist.bio) {
          existingArtist.bio = migrationArtist.bio;
          needsSave = true;
        }
        if (!existingArtist.location && migrationArtist.location) {
          existingArtist.location = migrationArtist.location;
          needsSave = true;
        }
        if (!existingArtist.coverImageKey && migrationArtist.image) {
          existingArtist.coverImageKey = migrationArtist.image;
          needsSave = true;
        }
        if (needsSave) {
          await existingArtist.save({ session });
        }
      }
    } else {
      const newArtist = await Artist.create(
        [
          {
            name: migrationArtist.name,
            bio: migrationArtist.bio,
            location: migrationArtist.location || "",
            createdBy: userId,
            accountType: "self",
            approvalStatus: "approved",
            uploadVersion: 2,
            coverImageKey: migrationArtist.image,
            socials: (migrationArtist.socialLinks || []).map((link) => ({
              platform: typeof link === "string" ? "website" : link.platform || "website",
              url: typeof link === "string" ? link : link.url,
            })),
          },
        ],
        { session }
      );
      artistId = newArtist[0]._id;

      if (workspaceDoc) {
        workspaceDoc.artistId = artistId;
        await workspaceDoc.save({ session });
      }
    }

    for (const malb of migrationAlbums) {
      const albumDoc = await Album.create(
        [
          {
            title: malb.title,
            description: malb.description,
            artist: artistId,
            coverImageKey: malb.coverImage || "",
            genre: malb.genres,
            releaseDate: malb.releaseDate || new Date(),
            accessType: "subscription",
          },
        ],
        { session }
      );

      const mtracks = await migrationTrackRepository.findByAlbumId(malb._id);
      const songIds = [];

      for (const mtrack of mtracks) {
        const songDoc = await Song.create(
          [
            {
              title: mtrack.title,
              artist: artistId,
              album: albumDoc[0]._id,
              trackNumber: mtrack.trackNumber,
              duration: mtrack.duration || 0,
              lyrics: mtrack.lyrics || "",
              credits: mtrack.credits || "",
              coverImageKey: malb.coverImage || "",
            },
          ],
          { session }
        );
        songIds.push(songDoc[0]._id);
      }

      albumDoc[0].songs = songIds;
      await albumDoc[0].save({ session });
    }

    await migrationJobRepository.updateStatus(jobId, "IMPORTED", 100, "COMPLETED");

    await session.commitTransaction();
    session.endSession();

    return { success: true, artistId };
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
};

const copyAssetToProduction = async (oldKey) => {
  return oldKey;
};

export const publishAlbumToProduction = async (albumId, userId) => {
  const album = await migrationAlbumRepository.findById(albumId);
  if (!album) throw new Error("Draft album not found");

  const artist = await migrationArtistRepository.findById(album.artistId);
  if (!artist) throw new Error("Draft artist not found");

  const mtracks = await migrationTrackRepository.findByAlbumId(albumId);
  if (!mtracks || mtracks.length === 0) {
    throw new Error("Cannot publish: Album has no tracks");
  }

  // Ensure all tracks have audio files uploaded
  const missingAudioTracks = mtracks.filter((t) => !t.audioKey);
  if (missingAudioTracks.length > 0) {
    const titles = missingAudioTracks.map((t) => `"${t.title}"`).join(", ");
    throw new Error(`Cannot publish: The following tracks are missing audio files: ${titles}`);
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    let artistId;
    let workspaceDoc;

    const job = await migrationJobRepository.findById(album.migrationJobId);
    if (job && job.workspaceId) {
      workspaceDoc = await Workspace.findById(job.workspaceId).session(session);
    }

    if (workspaceDoc && workspaceDoc.artistId) {
      artistId = workspaceDoc.artistId;
      const existingArtist = await Artist.findById(artistId).session(session);
      if (existingArtist) {
        let needsSave = false;
        if (!existingArtist.bio && artist.bio) {
          existingArtist.bio = artist.bio;
          needsSave = true;
        }
        if (!existingArtist.location && artist.location) {
          existingArtist.location = artist.location;
          needsSave = true;
        }
        if (!existingArtist.coverImageKey && artist.image) {
          existingArtist.coverImageKey = await copyAssetToProduction(artist.image);
          needsSave = true;
        }
        if (needsSave) {
          await existingArtist.save({ session });
        }
      }
    } else {
      let artistDoc = await Artist.findOne({ name: artist.name }).session(session);
      if (!artistDoc) {
        artistDoc = await Artist.create(
          [
            {
              name: artist.name,
              bio: artist.bio || "",
              location: artist.location || "",
              coverImageKey: await copyAssetToProduction(artist.image),
              createdBy: userId,
            },
          ],
          { session }
        );
        artistId = artistDoc[0]._id;
      } else {
        artistId = artistDoc._id;
      }

      if (workspaceDoc) {
        workspaceDoc.artistId = artistId;
        await workspaceDoc.save({ session });
      }
    }

    const albumDoc = await Album.create(
      [
        {
          title: album.title,
          artist: artistId,
          description: album.description || "",
          releaseDate: album.releaseDate || new Date(),
          genres: album.genres || [],
          coverImageKey: await copyAssetToProduction(album.coverImage),
        },
      ],
      { session }
    );

    const songIds = [];
    for (const mtrack of mtracks) {
      const songDoc = await Song.create(
        [
          {
            title: mtrack.title,
            artist: artistId,
            album: albumDoc[0]._id,
            duration: mtrack.duration || 0,
            lyrics: mtrack.lyrics || "",
            credits: mtrack.credits || "",
            coverImageKey: await copyAssetToProduction(album.coverImage),
            audioKey: mtrack.audioKey,
            genre: album.genres || [],
            status: "ready",
          },
        ],
        { session }
      );
      songIds.push(songDoc[0]._id);
    }

    albumDoc[0].songs = songIds;
    await albumDoc[0].save({ session });

    // Mark the draft album as PUBLISHED
    album.status = "PUBLISHED";
    await album.save({ session });

    if (job) {
      await migrationJobRepository.updateStatus(job._id, "IMPORTED", 100, "COMPLETED");
    }

    await session.commitTransaction();
    session.endSession();

    return { success: true, albumId: albumDoc[0]._id, artistId };
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
};

export const migrationService = {
  createMigration,
  startMigration,
  retryMigration,
  cancelMigration,
  importMigration,
  publishAlbumToProduction,
};


export default migrationService;
