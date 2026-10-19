// modules/analytics/infrastructure/analytics.repository.js
import { AnalyticsEvent } from "../domain/models/AnalyticsEvent.js";
import { SongDailyStats } from "../domain/models/SongDailyStats.js";
import { ArtistDailyStats } from "../domain/models/ArtistDailyStats.js";

/**
 * Format a Date object to "YYYY-MM-DD"
 */
export const getDayString = (date = new Date()) => {
  const d = new Date(date);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const analyticsRepository = {
  /**
   * Persists raw event into MongoDB.
   * Catches E11000 duplicate key errors cleanly for idempotency.
   */
  async saveRawEvent(eventData) {
    try {
      const doc = await AnalyticsEvent.create(eventData);
      return { event: doc, isDuplicate: false };
    } catch (err) {
      if (err.code === 11000) {
        // Idempotency: duplicate eventId encountered
        return { event: null, isDuplicate: true };
      }
      throw err;
    }
  },

  /**
   * Atomically upserts daily song metrics
   */
  async updateSongDailyStats({ songId, artistId, dateStr, listenerId, increments = {} }) {
    if (!songId) return;

    const date = dateStr || getDayString();
    const updateOps = {};

    // 1. Numeric increments
    const incFields = {};
    if (increments.plays) incFields.plays = increments.plays;
    if (increments.qualifiedPlays) incFields.qualifiedPlays = increments.qualifiedPlays;
    if (increments.completions) incFields.completions = increments.completions;
    if (increments.skips) incFields.skips = increments.skips;
    if (increments.likes) incFields.likes = increments.likes;

    if (Object.keys(incFields).length > 0) {
      updateOps.$inc = incFields;
    }

    // 2. Set on insert fields
    updateOps.$setOnInsert = {
      songId,
      artistId: artistId || null,
      date,
    };

    // 3. Unique listener tracking
    if (listenerId) {
      updateOps.$addToSet = { uniqueListeners: listenerId };
    }

    const doc = await SongDailyStats.findOneAndUpdate(
      { songId, date },
      updateOps,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Keep uniqueListenersCount aligned if new listener was added
    if (doc && doc.uniqueListeners && doc.uniqueListenersCount !== doc.uniqueListeners.length) {
      doc.uniqueListenersCount = doc.uniqueListeners.length;
      await doc.save();
    }

    return doc;
  },

  /**
   * Atomically upserts daily artist metrics
   */
  async updateArtistDailyStats({ artistId, dateStr, listenerId, increments = {} }) {
    if (!artistId) return;

    const date = dateStr || getDayString();
    const updateOps = {};

    const incFields = {};
    if (increments.plays) incFields.plays = increments.plays;
    if (increments.qualifiedPlays) incFields.qualifiedPlays = increments.qualifiedPlays;
    if (increments.likes) incFields.likes = increments.likes;
    if (increments.followers) incFields.followers = increments.followers;
    if (increments.subscriptionsStarted) incFields.subscriptionsStarted = increments.subscriptionsStarted;
    if (increments.subscriptionsRenewed) incFields.subscriptionsRenewed = increments.subscriptionsRenewed;
    if (increments.purchasesCompleted) incFields.purchasesCompleted = increments.purchasesCompleted;
    if (increments.revenueCents) incFields.revenueCents = increments.revenueCents;

    if (Object.keys(incFields).length > 0) {
      updateOps.$inc = incFields;
    }

    updateOps.$setOnInsert = {
      artistId,
      date,
    };

    if (listenerId) {
      updateOps.$addToSet = { uniqueListeners: listenerId };
    }

    const doc = await ArtistDailyStats.findOneAndUpdate(
      { artistId, date },
      updateOps,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    if (doc && doc.uniqueListeners && doc.uniqueListenersCount !== doc.uniqueListeners.length) {
      doc.uniqueListenersCount = doc.uniqueListeners.length;
      await doc.save();
    }

    return doc;
  },
};
