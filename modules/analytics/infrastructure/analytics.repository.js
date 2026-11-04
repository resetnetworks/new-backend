// modules/analytics/infrastructure/analytics.repository.js
import mongoose from "mongoose";
import { AnalyticsEvent } from "../domain/models/AnalyticsEvent.js";
import { CheckoutAttempt } from "../domain/models/CheckoutAttempt.js";
import { SongDailyStats } from "../domain/models/SongDailyStats.js";
import { ArtistDailyStats } from "../domain/models/ArtistDailyStats.js";
import { ANALYTICS_EVENTS } from "../domain/analytics.constants.js";
import { parseDateRange } from "../utils/date-range.helper.js";

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
   * Idempotent insert of an event into AnalyticsEvent collection.
   * If eventId already exists, ignore duplicate insert.
   */
  async upsertEvent(eventData) {
    const {
      eventId,
      funnelId,
      eventType,
      eventName,
      userId,
      artistId,
      songId,
      albumId,
      planId,
      metadata,
      properties,
      context,
      timestamp,
      occurredAt,
    } = eventData;

    const resolvedEventName = eventType || eventName;
    const resolvedTimestamp = timestamp ? new Date(timestamp) : (occurredAt ? new Date(occurredAt) : new Date());

    return AnalyticsEvent.updateOne(
      { eventId },
      {
        $setOnInsert: {
          eventId,
          funnelId: funnelId || null,
          eventName: resolvedEventName,
          eventType: resolvedEventName,
          userId: userId && mongoose.Types.ObjectId.isValid(userId) ? new mongoose.Types.ObjectId(userId) : null,
          artistId: artistId && mongoose.Types.ObjectId.isValid(artistId) ? new mongoose.Types.ObjectId(artistId) : null,
          songId: songId && mongoose.Types.ObjectId.isValid(songId) ? new mongoose.Types.ObjectId(songId) : null,
          albumId: albumId && mongoose.Types.ObjectId.isValid(albumId) ? new mongoose.Types.ObjectId(albumId) : null,
          planId: planId || null,
          metadata: metadata || properties || {},
          properties: properties || metadata || {},
          context: context || {},
          timestamp: resolvedTimestamp,
          occurredAt: resolvedTimestamp,
        },
      },
      { upsert: true }
    );
  },

  /**
   * Create a new authoritative checkout attempt
   */
  async createCheckoutAttempt(attemptData) {
    return CheckoutAttempt.create(attemptData);
  },

  /**
   * Find checkout attempt by ID
   */
  async findCheckoutAttemptById(attemptId) {
    return CheckoutAttempt.findById(attemptId);
  },

  /**
   * Find checkout attempt by funnel ID
   */
  async findCheckoutAttemptByFunnelId(funnelId) {
    return CheckoutAttempt.findOne({ funnelId });
  },

  /**
   * Find checkout attempt by gateway session ID
   */
  async findCheckoutAttemptBySessionId(sessionId) {
    return CheckoutAttempt.findOne({ gatewaySessionId: sessionId });
  },

  /**
   * Update status of a checkout attempt
   */
  async updateCheckoutAttemptStatus(funnelIdOrAttemptId, updateFields) {
    const isObjectId = mongoose.Types.ObjectId.isValid(funnelIdOrAttemptId);
    const filter = isObjectId
      ? { _id: funnelIdOrAttemptId }
      : { funnelId: funnelIdOrAttemptId };

    return CheckoutAttempt.findOneAndUpdate(filter, { $set: updateFields }, { new: true });
  },

  /**
   * Fetch complete event timeline for a given funnelId
   */
  async getEventsByFunnelId(funnelId) {
    return AnalyticsEvent.find({ funnelId }).sort({ occurredAt: 1, timestamp: 1 }).lean();
  },

  /**
   * Aggregate funnel stats for an artist (or platform-wide if artistId is null)
   */
  async getFunnelStats({ artistId, startDate, endDate, range } = {}) {
    const matchFilter = {};

    const isValidArtistId = artistId && artistId !== "all" && artistId !== "platform" && mongoose.Types.ObjectId.isValid(artistId);
    if (isValidArtistId) {
      const artistOid = new mongoose.Types.ObjectId(artistId);
      matchFilter.$or = [
        { artistId: artistOid },
        { artistId: String(artistId) },
      ];
    }

    let startIso = startDate || null;
    let endIso = endDate || null;

    if (range || startDate || endDate) {
      const parsed = parseDateRange({ range, startDate, endDate });
      matchFilter.occurredAt = {
        $gte: parsed.startDateTime,
        $lte: parsed.endDateTime,
      };
      startIso = parsed.startDate;
      endIso = parsed.endDate;
    }

    const countsByEvent = await AnalyticsEvent.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: { $ifNull: ["$eventType", "$eventName"] },
          totalEvents: { $sum: 1 },
          uniqueFunnels: {
            $addToSet: {
              $cond: [
                {
                  $and: [
                    { $ne: ["$funnelId", null] },
                    { $ne: ["$funnelId", ""] },
                  ],
                },
                "$funnelId",
                "$$REMOVE",
              ],
            },
          },
          uniqueUsers: {
            $addToSet: {
              $cond: [
                {
                  $and: [
                    { $ne: ["$userId", null] },
                    { $ne: ["$userId", ""] },
                  ],
                },
                "$userId",
                "$$REMOVE",
              ],
            },
          },
        },
      },
      {
        $project: {
          _id: 1,
          totalEvents: 1,
          uniqueFunnelsCount: { $size: "$uniqueFunnels" },
          uniqueUsersCount: { $size: "$uniqueUsers" },
        },
      },
    ]);

    // Build map of counts
    const eventCounts = {};
    for (const item of countsByEvent) {
      if (item._id) {
        eventCounts[item._id] = {
          totalEvents: item.totalEvents,
          uniqueFunnels: item.uniqueFunnelsCount,
          uniqueUsers: item.uniqueUsersCount,
        };
      }
    }

    const getStageCounts = (eventName) => {
      const stage = eventCounts[eventName] || { totalEvents: 0, uniqueFunnels: 0, uniqueUsers: 0 };
      return {
        total: stage.totalEvents || 0,
        unique: stage.uniqueFunnels || 0,
        uniqueUsers: stage.uniqueUsers || 0,
      };
    };

    const clicks = getStageCounts(ANALYTICS_EVENTS.SUBSCRIPTION_CLICKED);
    const checkoutStarted = getStageCounts(ANALYTICS_EVENTS.CHECKOUT_STARTED);
    const paymentInitiated = getStageCounts(ANALYTICS_EVENTS.PAYMENT_INITIATED);
    const paymentCompleted = getStageCounts(ANALYTICS_EVENTS.PAYMENT_COMPLETED);
    const paymentFailed = getStageCounts(ANALYTICS_EVENTS.PAYMENT_FAILED);
    const paymentAbandoned = getStageCounts(ANALYTICS_EVENTS.PAYMENT_ABANDONED);
    const subscriptionActivated = getStageCounts(ANALYTICS_EVENTS.SUBSCRIPTION_ACTIVATED);

    const calcRate = (numerator, denominator) =>
      denominator > 0 ? Number(((numerator / denominator) * 100).toFixed(2)) : 0;

    const effectiveClicks = clicks.total || clicks.unique;
    const effectiveCheckout = checkoutStarted.total || checkoutStarted.unique;
    const effectiveInitiated = paymentInitiated.total || paymentInitiated.unique;
    const effectiveCompleted = paymentCompleted.total || paymentCompleted.unique;

    return {
      artistId: isValidArtistId ? artistId : "platform",
      period: {
        startDate: startIso,
        endDate: endIso,
      },
      funnelCounts: {
        subscription_clicked: clicks.total,
        checkout_started: checkoutStarted.total,
        payment_initiated: paymentInitiated.total,
        payment_completed: paymentCompleted.total,
        payment_failed: paymentFailed.total,
        payment_abandoned: paymentAbandoned.total,
        subscription_activated: subscriptionActivated.total,
      },
      uniqueCounts: {
        subscription_clicked: clicks.unique,
        checkout_started: checkoutStarted.unique,
        payment_initiated: paymentInitiated.unique,
        payment_completed: paymentCompleted.unique,
        payment_failed: paymentFailed.unique,
        payment_abandoned: paymentAbandoned.unique,
        subscription_activated: subscriptionActivated.unique,
      },
      totalCounts: {
        subscription_clicked: clicks.total,
        checkout_started: checkoutStarted.total,
        payment_initiated: paymentInitiated.total,
        payment_completed: paymentCompleted.total,
        payment_failed: paymentFailed.total,
        payment_abandoned: paymentAbandoned.total,
        subscription_activated: subscriptionActivated.total,
      },
      totalAbandoned: paymentAbandoned.total,
      totalAbandonedEvents: paymentAbandoned.total,
      conversionRates: {
        clickToCheckoutRate: calcRate(effectiveCheckout, effectiveClicks),
        checkoutToInitiatedRate: calcRate(effectiveInitiated, effectiveCheckout),
        initiatedToCompletedRate: calcRate(effectiveCompleted, effectiveInitiated),
        overallConversionRate: calcRate(effectiveCompleted, effectiveClicks),
      },
      dropOffs: {
        abandonedAtCheckout: Math.max(0, effectiveClicks - effectiveCheckout),
        abandonedBeforePayment: Math.max(0, effectiveCheckout - effectiveInitiated),
        abandonedOrFailedDuringPayment: Math.max(0, effectiveInitiated - effectiveCompleted),
        paymentAbandoned: paymentAbandoned.total,
        totalDropOffRate: effectiveClicks > 0 ? Number((((effectiveClicks - effectiveCompleted) / effectiveClicks) * 100).toFixed(2)) : 0,
      },
    };
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

export default analyticsRepository;
