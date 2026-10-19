// modules/analytics/infrastructure/analytics.worker.js
import { Worker } from "bullmq";
import mongoose from "mongoose";
import { redisConnection } from "../../../queue/connection.js";
import { ANALYTICS_QUEUE_NAME } from "../domain/analytics.constants.js";
import { analyticsRepository } from "./analytics.repository.js";
import { eventRouter } from "../application/event-router.js";
import { Album } from "../../../models/album.model.js";
import { Song } from "../../../models/song.model.js";
import { Artist } from "../../artist/models/artist.model.js";

/**
 * Resolves missing songId, albumId, artistId using slugs if provided in properties
 */
export const enrichEntityIds = async (eventData) => {
  const { properties = {} } = eventData;

  try {
    // 1. Resolve Album and its Artist
    if (!eventData.albumId && (properties.albumSlug || properties.albumId)) {
      const identifier = properties.albumSlug || properties.albumId;
      const isObjectId = mongoose.Types.ObjectId.isValid(identifier);
      const album = await Album.findOne(
        isObjectId ? { $or: [{ slug: identifier }, { _id: identifier }] } : { slug: identifier }
      )
        .select("_id artist")
        .lean();

      if (album) {
        eventData.albumId = album._id;
        if (!eventData.artistId && album.artist) {
          eventData.artistId = album.artist;
        }
      }
    }

    // 2. Resolve Artist
    if (!eventData.artistId && (properties.artistSlug || properties.artistId)) {
      const identifier = properties.artistSlug || properties.artistId;
      const isObjectId = mongoose.Types.ObjectId.isValid(identifier);
      const artist = await Artist.findOne(
        isObjectId ? { $or: [{ slug: identifier }, { _id: identifier }] } : { slug: identifier }
      )
        .select("_id")
        .lean();

      if (artist) {
        eventData.artistId = artist._id;
      }
    }

    // 3. Resolve Song, its Artist, and its Album
    if (!eventData.songId && (properties.songSlug || properties.songId)) {
      const identifier = properties.songSlug || properties.songId;
      const isObjectId = mongoose.Types.ObjectId.isValid(identifier);
      const song = await Song.findOne(
        isObjectId ? { $or: [{ slug: identifier }, { _id: identifier }] } : { slug: identifier }
      )
        .select("_id artist album")
        .lean();

      if (song) {
        eventData.songId = song._id;
        if (!eventData.artistId && song.artist) {
          eventData.artistId = song.artist;
        }
        if (!eventData.albumId && song.album) {
          eventData.albumId = song.album;
        }
      }
    }
  } catch (err) {
    console.warn("[AnalyticsWorker] Entity enrichment error:", err.message);
  }

  return eventData;
};

export const analyticsWorker = new Worker(
  ANALYTICS_QUEUE_NAME,
  async (job) => {
    let eventData = job.data;

    // 1. Automatically enrich missing entity IDs from slugs if present
    eventData = await enrichEntityIds(eventData);

    // 2. Idempotent raw storage
    const { isDuplicate } = await analyticsRepository.saveRawEvent(eventData);

    if (isDuplicate) {
      // Event was already processed — skip side effects to prevent double counting
      return { status: "duplicate_skipped", eventId: eventData.eventId };
    }

    // 3. Route derived analytics (Recently Played, Daily aggregations)
    await eventRouter.route(eventData);

    return { status: "processed", eventId: eventData.eventId };
  },
  {
    connection: redisConnection,
    concurrency: 5,
  }
);


analyticsWorker.on("completed", (job) => {
  // Silent in production or debug logging
});

analyticsWorker.on("failed", (job, err) => {
  console.error(`[AnalyticsWorker] Job ${job?.id} (${job?.name}) failed:`, err.message);
});
