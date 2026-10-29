// modules/analytics/application/analytics.service.js
import { randomUUID } from "crypto";
import mongoose from "mongoose";
import { eventDispatcher } from "./eventDispatcher.js";
import { analyticsProducer } from "../infrastructure/analytics.producer.js";
import { analyticsRepository } from "../infrastructure/analytics.repository.js";
import { validateAnalyticsEvent } from "./event-validator.js";
import {
  ANALYTICS_EVENTS,
  CHECKOUT_ATTEMPT_STATUS,
  DEFAULT_ABANDON_TIMEOUT_MS,
} from "../domain/analytics.constants.js";
import { SongDailyStats } from "../domain/models/SongDailyStats.js";
import { ArtistDailyStats } from "../domain/models/ArtistDailyStats.js";
import { AnalyticsEvent } from "../domain/models/AnalyticsEvent.js";
import { Artist } from "../../artist/models/artist.model.js";
import { Song } from "../../../models/song.model.js";
import { User } from "../../../models/User.js";
import { parseDateRange, generateDateList } from "../utils/date-range.helper.js";

export const analyticsService = {
  /**
   * Tracks an event via the asynchronous queue
   */
  async track(eventPayload) {
    return eventDispatcher.publish(eventPayload);
  },

  /**
   * Track an event: validates and enqueues to BullMQ worker (supports funnel / legacy event format)
   */
  async trackEvent(eventData) {
    const enrichedEvent = {
      ...eventData,
      eventId: eventData.eventId || randomUUID(),
      timestamp: eventData.timestamp || eventData.occurredAt || new Date(),
      occurredAt: eventData.occurredAt || eventData.timestamp || new Date(),
    };

    const validation = validateAnalyticsEvent(enrichedEvent);
    if (!validation.isValid) {
      const err = new Error(`Invalid analytics event: ${validation.errors.join("; ")}`);
      err.status = 400;
      throw err;
    }

    await analyticsProducer.publishEvent(enrichedEvent);
    return enrichedEvent;
  },

  /**
   * Tracks multiple events in batch
   */
  async trackBatch(events = []) {
    return eventDispatcher.publishBatch(events);
  },

  /**
   * Directly record event to database (for fast-path or sync fallback)
   */
  async recordEventDirect(eventData) {
    const enrichedEvent = {
      ...eventData,
      eventId: eventData.eventId || randomUUID(),
      timestamp: eventData.timestamp || eventData.occurredAt || new Date(),
      occurredAt: eventData.occurredAt || eventData.timestamp || new Date(),
    };

    const validation = validateAnalyticsEvent(enrichedEvent);
    if (!validation.isValid) {
      throw new Error(`Invalid analytics event: ${validation.errors.join("; ")}`);
    }

    await analyticsRepository.upsertEvent(enrichedEvent);
    return enrichedEvent;
  },

  /**
   * Start a checkout attempt funnel:
   * 1. Creates authoritative CheckoutAttempt record with status "pending"
   * 2. Schedules BullMQ delayed job for detecting abandoned payment
   * 3. Publishes checkout_started and payment_initiated events
   */
  async startCheckoutFunnel({
    funnelId,
    userId,
    artistId,
    planId,
    cycle,
    gateway,
    gatewaySessionId,
    transactionId,
    amount,
    currency,
    metadata = {},
    abandonTimeoutMs = DEFAULT_ABANDON_TIMEOUT_MS,
  }) {
    const expiresAt = new Date(Date.now() + abandonTimeoutMs);

    // 1. Authoritative CheckoutAttempt record
    const attempt = await analyticsRepository.createCheckoutAttempt({
      funnelId,
      userId,
      artistId,
      planId,
      cycle,
      gateway,
      gatewaySessionId,
      transactionId,
      amount,
      currency,
      status: CHECKOUT_ATTEMPT_STATUS.PENDING,
      expiresAt,
      metadata,
    });

    // 2. Schedule delayed check for abandoned payment
    try {
      await analyticsProducer.scheduleAbandonmentCheck(attempt._id, abandonTimeoutMs);
    } catch (schedErr) {
      console.warn("[Analytics] Failed to schedule abandonment check:", schedErr.message);
    }

    // 3. Emit checkout_started event
    await analyticsProducer.publishEvent({
      eventId: `checkout:${gatewaySessionId || attempt._id.toString()}`,
      funnelId,
      eventName: ANALYTICS_EVENTS.CHECKOUT_STARTED,
      eventType: ANALYTICS_EVENTS.CHECKOUT_STARTED,
      userId,
      artistId,
      planId,
      metadata: {
        checkoutSessionId: gatewaySessionId,
        cycle,
        amount,
        currency,
        gateway,
        transactionId,
      },
      timestamp: new Date(),
      occurredAt: new Date(),
    });

    // 4. Emit payment_initiated event
    await analyticsProducer.publishEvent({
      eventId: `payment_init:${attempt._id.toString()}`,
      funnelId,
      eventName: ANALYTICS_EVENTS.PAYMENT_INITIATED,
      eventType: ANALYTICS_EVENTS.PAYMENT_INITIATED,
      userId,
      artistId,
      planId,
      metadata: {
        attemptId: attempt._id.toString(),
        gateway,
        amount,
        currency,
      },
      timestamp: new Date(),
      occurredAt: new Date(),
    });

    return attempt;
  },

  /**
   * Reconcile and mark checkout as abandoned if still pending when timeout job fires
   */
  async checkAndAbandonPayment(attemptId) {
    const attempt = await analyticsRepository.findCheckoutAttemptById(attemptId);
    if (!attempt) {
      console.warn(`[Analytics] Abandonment check: Attempt ${attemptId} not found`);
      return null;
    }

    if (attempt.status !== CHECKOUT_ATTEMPT_STATUS.PENDING) {
      console.log(`[Analytics] Attempt ${attemptId} already in status '${attempt.status}', skipping abandonment`);
      return attempt;
    }

    const updatedAttempt = await analyticsRepository.updateCheckoutAttemptStatus(attempt._id, {
      status: CHECKOUT_ATTEMPT_STATUS.ABANDONED,
      abandonedAt: new Date(),
      failureReason: "checkout_timeout_no_payment",
    });

    await analyticsProducer.publishEvent({
      eventId: `payment_abandoned:${attempt._id.toString()}`,
      funnelId: attempt.funnelId,
      eventName: ANALYTICS_EVENTS.PAYMENT_ABANDONED,
      eventType: ANALYTICS_EVENTS.PAYMENT_ABANDONED,
      userId: attempt.userId,
      artistId: attempt.artistId,
      planId: attempt.planId || attempt.cycle,
      metadata: {
        attemptId: attempt._id.toString(),
        gatewaySessionId: attempt.gatewaySessionId,
        gateway: attempt.gateway,
        timeoutMs: DEFAULT_ABANDON_TIMEOUT_MS,
      },
      timestamp: new Date(),
      occurredAt: new Date(),
    });

    console.warn(`[Analytics] Funnel ${attempt.funnelId}: Marked checkout attempt ${attempt._id} as abandoned`);
    return updatedAttempt;
  },

  /**
   * Reconcile payment completion from webhook
   */
  async completePaymentFunnel({
    funnelId,
    gatewaySessionId,
    userId,
    artistId,
    planId,
    transactionId,
    amount,
    currency,
    gateway = "stripe",
    metadata = {},
  }) {
    if (funnelId) {
      await analyticsRepository.updateCheckoutAttemptStatus(funnelId, {
        status: CHECKOUT_ATTEMPT_STATUS.COMPLETED,
        completedAt: new Date(),
      });
    }

    const eventId = `payment_completed:${gatewaySessionId || transactionId || randomUUID()}`;

    await analyticsProducer.publishEvent({
      eventId,
      funnelId: funnelId || `funnel_${transactionId}`,
      eventName: ANALYTICS_EVENTS.PAYMENT_COMPLETED,
      eventType: ANALYTICS_EVENTS.PAYMENT_COMPLETED,
      userId,
      artistId,
      planId,
      metadata: {
        transactionId,
        gatewaySessionId,
        amount,
        currency,
        gateway,
        ...metadata,
      },
      timestamp: new Date(),
      occurredAt: new Date(),
    });
  },

  /**
   * Reconcile payment failure from webhook
   */
  async failPaymentFunnel({
    funnelId,
    gatewaySessionId,
    userId,
    artistId,
    planId,
    reason,
    gateway = "stripe",
    metadata = {},
  }) {
    if (funnelId) {
      await analyticsRepository.updateCheckoutAttemptStatus(funnelId, {
        status: CHECKOUT_ATTEMPT_STATUS.FAILED,
        failedAt: new Date(),
        failureReason: reason,
      });
    }

    const eventId = `payment_failed:${gatewaySessionId || randomUUID()}`;

    await analyticsProducer.publishEvent({
      eventId,
      funnelId: funnelId || `funnel_${randomUUID()}`,
      eventName: ANALYTICS_EVENTS.PAYMENT_FAILED,
      eventType: ANALYTICS_EVENTS.PAYMENT_FAILED,
      userId,
      artistId,
      planId,
      metadata: {
        gatewaySessionId,
        reason,
        gateway,
        ...metadata,
      },
      timestamp: new Date(),
      occurredAt: new Date(),
    });
  },

  /**
   * Record subscription activation event
   */
  async recordSubscriptionActivated({
    funnelId,
    subscriptionId,
    externalSubscriptionId,
    userId,
    artistId,
    cycle,
    validUntil,
  }) {
    const eventId = `sub_activated:${externalSubscriptionId || subscriptionId || randomUUID()}`;

    await analyticsProducer.publishEvent({
      eventId,
      funnelId: funnelId || `sub_${subscriptionId}`,
      eventName: ANALYTICS_EVENTS.SUBSCRIPTION_ACTIVATED,
      eventType: ANALYTICS_EVENTS.SUBSCRIPTION_ACTIVATED,
      userId,
      artistId,
      planId: cycle,
      metadata: {
        subscriptionId,
        externalSubscriptionId,
        cycle,
        validUntil,
      },
      timestamp: new Date(),
      occurredAt: new Date(),
    });
  },

  /**
   * Fetch aggregate funnel metrics
   */
  async getFunnelMetrics({ artistId, startDate, endDate }) {
    return analyticsRepository.getFunnelStats({ artistId, startDate, endDate });
  },

  /**
   * Fetch events by funnel ID
   */
  async getEventsByFunnelId(funnelId) {
    return analyticsRepository.getEventsByFunnelId(funnelId);
  },

  /**
   * Get historical daily metrics for a song
   */
  async getSongStats(songId, { startDate, endDate, limit = 30 } = {}) {
    const query = { songId };
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = startDate;
      if (endDate) query.date.$lte = endDate;
    }
    return SongDailyStats.find(query).sort({ date: -1 }).limit(limit).lean();
  },

  /**
   * Get historical daily metrics for an artist
   */
  async getArtistStats(artistId, { startDate, endDate, limit = 30 } = {}) {
    const query = { artistId };
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = startDate;
      if (endDate) query.date.$lte = endDate;
    }
    return ArtistDailyStats.find(query).sort({ date: -1 }).limit(limit).lean();
  },

  /**
   * Query raw analytics events with filtering
   */
  async queryEvents(filters = {}, { limit = 50, page = 1 } = {}) {
    const skip = (page - 1) * limit;
    const [events, total] = await Promise.all([
      AnalyticsEvent.find(filters).sort({ occurredAt: -1 }).skip(skip).limit(limit).lean(),
      AnalyticsEvent.countDocuments(filters),
    ]);
    return { events, total, page, limit };
  },

  /**
   * ARTIST DASHBOARD: Aggregated Overview
   */
  async getArtistOverview(artistId, query = {}) {
    if (!mongoose.Types.ObjectId.isValid(artistId)) {
      throw new Error("Invalid artist ID");
    }

    const { startDate, endDate, startDateTime, endDateTime } = parseDateRange(query);
    const artistObjectId = new mongoose.Types.ObjectId(artistId);

    // 1. Daily stats aggregation (plays, listeners, followers, revenue)
    const [artistStatsAgg] = await ArtistDailyStats.aggregate([
      {
        $match: {
          artistId: artistObjectId,
          date: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: null,
          totalPlays: { $sum: "$plays" },
          qualifiedPlays: { $sum: "$qualifiedPlays" },
          followersGained: { $sum: "$followers" },
          likes: { $sum: "$likes" },
          subscriptionsStarted: { $sum: "$subscriptionsStarted" },
          subscriptionsRenewed: { $sum: "$subscriptionsRenewed" },
          purchasesCompleted: { $sum: "$purchasesCompleted" },
          revenueCents: { $sum: "$revenueCents" },
        },
      },
    ]);

    // 2. Song stats aggregation for completions and skips
    const [songStatsAgg] = await SongDailyStats.aggregate([
      {
        $match: {
          artistId: artistObjectId,
          date: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: null,
          completions: { $sum: "$completions" },
          skips: { $sum: "$skips" },
        },
      },
    ]);

    // 3. Traffic views aggregation from AnalyticsEvent (artist_viewed, album_viewed, song_viewed)
    const trafficEventsAgg = await AnalyticsEvent.aggregate([
      {
        $match: {
          artistId: artistObjectId,
          $or: [
            { eventName: { $in: ["artist_viewed", "album_viewed", "song_viewed"] } },
            { eventType: { $in: ["artist_viewed", "album_viewed", "song_viewed"] } },
          ],
          occurredAt: { $gte: startDateTime, $lte: endDateTime },
        },
      },
      {
        $group: {
          _id: { $ifNull: ["$eventName", "$eventType"] },
          count: { $sum: 1 },
          uniqueVisitors: { $addToSet: { $ifNull: ["$userId", "$anonymousId"] } },
        },
      },
    ]);

    // Format traffic
    const trafficMap = {};
    for (const item of trafficEventsAgg) {
      trafficMap[item._id] = {
        count: item.count,
        uniqueCount: item.uniqueVisitors?.filter(Boolean).length || 0,
      };
    }

    // 4. Current artist info (follower count, name, etc.)
    const artistDoc = await Artist.findById(artistObjectId).select("name handle followerCount avatar").lean();

    const totalPlays = artistStatsAgg?.totalPlays || 0;
    const qualifiedPlays = artistStatsAgg?.qualifiedPlays || 0;
    const completions = songStatsAgg?.completions || 0;
    const skips = songStatsAgg?.skips || 0;
    const revenueCents = artistStatsAgg?.revenueCents || 0;

    const completionRate = totalPlays > 0 ? Number(((completions / totalPlays) * 100).toFixed(2)) : 0;
    const skipRate = totalPlays > 0 ? Number(((skips / totalPlays) * 100).toFixed(2)) : 0;

    return {
      range: {
        startDate,
        endDate,
      },
      artist: {
        id: artistId,
        name: artistDoc?.name || "Unknown Artist",
        handle: artistDoc?.handle || "",
        avatar: artistDoc?.avatar || null,
        currentFollowers: artistDoc?.followerCount || 0,
      },
      traffic: {
        profileViews: trafficMap["artist_viewed"]?.count || 0,
        uniqueProfileVisitors: trafficMap["artist_viewed"]?.uniqueCount || 0,
        albumViews: trafficMap["album_viewed"]?.count || 0,
        uniqueAlbumVisitors: trafficMap["album_viewed"]?.uniqueCount || 0,
        songViews: trafficMap["song_viewed"]?.count || 0,
        uniqueSongVisitors: trafficMap["song_viewed"]?.uniqueCount || 0,
      },
      playback: {
        totalPlays,
        qualifiedPlays,
        completions,
        skips,
        completionRate,
        skipRate,
      },
      audience: {
        newFollowers: artistStatsAgg?.followersGained || 0,
        likes: artistStatsAgg?.likes || 0,
      },
      monetization: {
        revenueCents,
        revenueFormatted: `$${(revenueCents / 100).toFixed(2)}`,
        purchasesCompleted: artistStatsAgg?.purchasesCompleted || 0,
        subscriptionsStarted: artistStatsAgg?.subscriptionsStarted || 0,
        subscriptionsRenewed: artistStatsAgg?.subscriptionsRenewed || 0,
      },
    };
  },

  /**
   * ARTIST DASHBOARD: Continuous Day-by-Day Timeseries for Charts
   */
  async getArtistTimeseries(artistId, query = {}) {
    if (!mongoose.Types.ObjectId.isValid(artistId)) {
      throw new Error("Invalid artist ID");
    }

    const { startDate, endDate, startDateTime, endDateTime } = parseDateRange(query);
    const artistObjectId = new mongoose.Types.ObjectId(artistId);

    const dailyStats = await ArtistDailyStats.find({
      artistId: artistObjectId,
      date: { $gte: startDate, $lte: endDate },
    }).lean();

    const dailyStatsMap = new Map();
    for (const stat of dailyStats) {
      dailyStatsMap.set(stat.date, stat);
    }

    const dailySongStats = await SongDailyStats.aggregate([
      {
        $match: {
          artistId: artistObjectId,
          date: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: "$date",
          completions: { $sum: "$completions" },
          skips: { $sum: "$skips" },
        },
      },
    ]);

    const dailySongStatsMap = new Map();
    for (const item of dailySongStats) {
      dailySongStatsMap.set(item._id, item);
    }

    const dailyTrafficEvents = await AnalyticsEvent.aggregate([
      {
        $match: {
          artistId: artistObjectId,
          $or: [
            { eventName: { $in: ["artist_viewed", "album_viewed", "song_viewed"] } },
            { eventType: { $in: ["artist_viewed", "album_viewed", "song_viewed"] } },
          ],
          occurredAt: { $gte: startDateTime, $lte: endDateTime },
        },
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$occurredAt" } },
            eventName: { $ifNull: ["$eventName", "$eventType"] },
          },
          count: { $sum: 1 },
        },
      },
    ]);

    const trafficMap = new Map();
    for (const item of dailyTrafficEvents) {
      trafficMap.set(`${item._id.date}:${item._id.eventName}`, item.count);
    }

    const dateList = generateDateList(startDate, endDate);

    const timeseries = dateList.map((date) => {
      const stat = dailyStatsMap.get(date);
      const songStat = dailySongStatsMap.get(date);

      return {
        date,
        plays: stat?.plays || 0,
        qualifiedPlays: stat?.qualifiedPlays || 0,
        completions: songStat?.completions || 0,
        skips: songStat?.skips || 0,
        profileViews: trafficMap.get(`${date}:artist_viewed`) || 0,
        albumViews: trafficMap.get(`${date}:album_viewed`) || 0,
        songViews: trafficMap.get(`${date}:song_viewed`) || 0,
        followers: stat?.followers || 0,
        likes: stat?.likes || 0,
        revenueCents: stat?.revenueCents || 0,
      };
    });

    return {
      range: { startDate, endDate },
      timeseries,
    };
  },

  /**
   * ARTIST DASHBOARD: Top Performing Songs
   */
  async getArtistTopSongs(artistId, query = {}) {
    if (!mongoose.Types.ObjectId.isValid(artistId)) {
      throw new Error("Invalid artist ID");
    }

    const { startDate, endDate } = parseDateRange(query);
    const limit = Math.min(50, Math.max(1, parseInt(query.limit, 10) || 10));
    const artistObjectId = new mongoose.Types.ObjectId(artistId);

    const sortField = query.sortBy === "likes"
      ? "likes"
      : query.sortBy === "qualifiedPlays"
      ? "qualifiedPlays"
      : query.sortBy === "completions"
      ? "completions"
      : "plays";

    const topSongsAgg = await SongDailyStats.aggregate([
      {
        $match: {
          artistId: artistObjectId,
          date: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: "$songId",
          plays: { $sum: "$plays" },
          qualifiedPlays: { $sum: "$qualifiedPlays" },
          completions: { $sum: "$completions" },
          skips: { $sum: "$skips" },
          likes: { $sum: "$likes" },
        },
      },
      { $sort: { [sortField]: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: "songs",
          localField: "_id",
          foreignField: "_id",
          as: "songInfo",
        },
      },
      { $unwind: { path: "$songInfo", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          songId: "$_id",
          title: { $ifNull: ["$songInfo.title", "Unknown Track"] },
          slug: { $ifNull: ["$songInfo.slug", ""] },
          artwork: { $ifNull: ["$songInfo.artwork", null] },
          duration: { $ifNull: ["$songInfo.duration", 0] },
          plays: 1,
          qualifiedPlays: 1,
          completions: 1,
          skips: 1,
          likes: 1,
          completionRate: {
            $cond: [
              { $gt: ["$plays", 0] },
              { $round: [{ $multiply: [{ $divide: ["$completions", "$plays"] }, 100] }, 2] },
              0,
            ],
          },
        },
      },
    ]);

    return {
      range: { startDate, endDate },
      songs: topSongsAgg,
    };
  },

  /**
   * ADMIN DASHBOARD: Platform-Wide Overview
   */
  async getAdminOverview(query = {}) {
    const { startDate, endDate, startDateTime, endDateTime } = parseDateRange(query);

    const platformEventsAgg = await AnalyticsEvent.aggregate([
      {
        $match: {
          $or: [
            {
              eventName: {
                $in: [
                  "landing_page_viewed",
                  "home_page_viewed",
                  "search_performed",
                  "search_result_clicked",
                  "signup_started",
                  "signup_completed",
                  "login_completed",
                ],
              },
            },
            {
              eventType: {
                $in: [
                  "landing_page_viewed",
                  "home_page_viewed",
                  "search_performed",
                  "search_result_clicked",
                  "signup_started",
                  "signup_completed",
                  "login_completed",
                ],
              },
            },
          ],
          occurredAt: { $gte: startDateTime, $lte: endDateTime },
        },
      },
      {
        $group: {
          _id: { $ifNull: ["$eventName", "$eventType"] },
          count: { $sum: 1 },
          uniqueUsers: { $addToSet: { $ifNull: ["$userId", "$anonymousId"] } },
        },
      },
    ]);

    const eventsMap = {};
    for (const ev of platformEventsAgg) {
      eventsMap[ev._id] = {
        count: ev.count,
        uniqueCount: ev.uniqueUsers?.filter(Boolean).length || 0,
      };
    }

    const [playbackAgg] = await SongDailyStats.aggregate([
      {
        $match: {
          date: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: null,
          totalPlays: { $sum: "$plays" },
          qualifiedPlays: { $sum: "$qualifiedPlays" },
          completions: { $sum: "$completions" },
          skips: { $sum: "$skips" },
          likes: { $sum: "$likes" },
        },
      },
    ]);

    const [monetizationAgg] = await ArtistDailyStats.aggregate([
      {
        $match: {
          date: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: null,
          revenueCents: { $sum: "$revenueCents" },
          purchasesCompleted: { $sum: "$purchasesCompleted" },
          subscriptionsStarted: { $sum: "$subscriptionsStarted" },
          subscriptionsRenewed: { $sum: "$subscriptionsRenewed" },
          followersGained: { $sum: "$followers" },
        },
      },
    ]);

    const [totalUsers, totalArtists, totalSongs] = await Promise.all([
      User.countDocuments(),
      Artist.countDocuments(),
      Song.countDocuments(),
    ]);

    const signupsStarted = eventsMap["signup_started"]?.count || 0;
    const signupsCompleted = eventsMap["signup_completed"]?.count || 0;
    const signupConversionRate = signupsStarted > 0
      ? Number(((signupsCompleted / signupsStarted) * 100).toFixed(2))
      : 0;

    const totalPlays = playbackAgg?.totalPlays || 0;
    const qualifiedPlays = playbackAgg?.qualifiedPlays || 0;
    const completions = playbackAgg?.completions || 0;
    const skips = playbackAgg?.skips || 0;
    const completionRate = totalPlays > 0 ? Number(((completions / totalPlays) * 100).toFixed(2)) : 0;
    const skipRate = totalPlays > 0 ? Number(((skips / totalPlays) * 100).toFixed(2)) : 0;

    const revenueCents = monetizationAgg?.revenueCents || 0;

    return {
      range: { startDate, endDate },
      platformTotals: {
        users: totalUsers,
        artists: totalArtists,
        songs: totalSongs,
      },
      traffic: {
        landingPageViews: eventsMap["landing_page_viewed"]?.count || 0,
        uniqueLandingVisitors: eventsMap["landing_page_viewed"]?.uniqueCount || 0,
        homePageViews: eventsMap["home_page_viewed"]?.count || 0,
        uniqueHomeVisitors: eventsMap["home_page_viewed"]?.uniqueCount || 0,
        searchesPerformed: eventsMap["search_performed"]?.count || 0,
        searchResultsClicked: eventsMap["search_result_clicked"]?.count || 0,
      },
      userGrowth: {
        signupsStarted,
        signupsCompleted,
        signupConversionRate,
        loginsCompleted: eventsMap["login_completed"]?.count || 0,
      },
      playback: {
        totalPlays,
        qualifiedPlays,
        completions,
        skips,
        completionRate,
        skipRate,
      },
      monetization: {
        revenueCents,
        revenueFormatted: `$${(revenueCents / 100).toFixed(2)}`,
        purchasesCompleted: monetizationAgg?.purchasesCompleted || 0,
        subscriptionsStarted: monetizationAgg?.subscriptionsStarted || 0,
        subscriptionsRenewed: monetizationAgg?.subscriptionsRenewed || 0,
      },
    };
  },

  /**
   * ADMIN DASHBOARD: Breakdown of Artists Performance
   */
  async getAdminArtistsSummary(query = {}) {
    const { startDate, endDate } = parseDateRange(query);
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const sortBy = query.sortBy || "plays";
    const sortKey = sortBy === "revenue"
      ? "revenueCents"
      : sortBy === "followers"
      ? "followersGained"
      : sortBy === "qualifiedPlays"
      ? "qualifiedPlays"
      : "plays";

    const facetResults = await ArtistDailyStats.aggregate([
      {
        $match: {
          date: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: "$artistId",
          plays: { $sum: "$plays" },
          qualifiedPlays: { $sum: "$qualifiedPlays" },
          revenueCents: { $sum: "$revenueCents" },
          followersGained: { $sum: "$followers" },
          likes: { $sum: "$likes" },
        },
      },
      {
        $facet: {
          metadata: [{ $count: "total" }],
          data: [
            { $sort: { [sortKey]: -1 } },
            { $skip: skip },
            { $limit: limit },
            {
              $lookup: {
                from: "artists",
                localField: "_id",
                foreignField: "_id",
                as: "artistInfo",
              },
            },
            { $unwind: { path: "$artistInfo", preserveNullAndEmptyArrays: true } },
            {
              $project: {
                _id: 1,
                artistId: "$_id",
                name: { $ifNull: ["$artistInfo.name", "Unknown Artist"] },
                handle: { $ifNull: ["$artistInfo.handle", ""] },
                avatar: { $ifNull: ["$artistInfo.avatar", null] },
                isVerified: { $ifNull: ["$artistInfo.isVerified", false] },
                followerCount: { $ifNull: ["$artistInfo.followerCount", 0] },
                plays: 1,
                qualifiedPlays: 1,
                revenueCents: 1,
                followersGained: 1,
                likes: 1,
              },
            },
          ],
        },
      },
    ]);

    const total = facetResults[0]?.metadata[0]?.total || 0;
    const artists = facetResults[0]?.data || [];

    return {
      range: { startDate, endDate },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      artists,
    };
  },

  /**
   * ADMIN DASHBOARD: Platform-Wide Continuous Timeseries for Charts
   */
  async getAdminTimeseries(query = {}) {
    const { startDate, endDate, startDateTime, endDateTime } = parseDateRange(query);

    const dailyPlays = await SongDailyStats.aggregate([
      {
        $match: {
          date: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: "$date",
          plays: { $sum: "$plays" },
          qualifiedPlays: { $sum: "$qualifiedPlays" },
          completions: { $sum: "$completions" },
          skips: { $sum: "$skips" },
        },
      },
    ]);

    const dailyPlaysMap = new Map();
    for (const item of dailyPlays) {
      dailyPlaysMap.set(item._id, item);
    }

    const dailyMonetization = await ArtistDailyStats.aggregate([
      {
        $match: {
          date: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: "$date",
          revenueCents: { $sum: "$revenueCents" },
          purchasesCompleted: { $sum: "$purchasesCompleted" },
          subscriptionsStarted: { $sum: "$subscriptionsStarted" },
        },
      },
    ]);

    const dailyMonetizationMap = new Map();
    for (const item of dailyMonetization) {
      dailyMonetizationMap.set(item._id, item);
    }

    const dailyEvents = await AnalyticsEvent.aggregate([
      {
        $match: {
          $or: [
            { eventName: { $in: ["landing_page_viewed", "home_page_viewed", "signup_completed"] } },
            { eventType: { $in: ["landing_page_viewed", "home_page_viewed", "signup_completed"] } },
          ],
          occurredAt: { $gte: startDateTime, $lte: endDateTime },
        },
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$occurredAt" } },
            eventName: { $ifNull: ["$eventName", "$eventType"] },
          },
          count: { $sum: 1 },
        },
      },
    ]);

    const eventsMap = new Map();
    for (const item of dailyEvents) {
      eventsMap.set(`${item._id.date}:${item._id.eventName}`, item.count);
    }

    const dateList = generateDateList(startDate, endDate);

    const timeseries = dateList.map((date) => {
      const playItem = dailyPlaysMap.get(date);
      const moneyItem = dailyMonetizationMap.get(date);

      return {
        date,
        plays: playItem?.plays || 0,
        qualifiedPlays: playItem?.qualifiedPlays || 0,
        completions: playItem?.completions || 0,
        skips: playItem?.skips || 0,
        landingPageViews: eventsMap.get(`${date}:landing_page_viewed`) || 0,
        homePageViews: eventsMap.get(`${date}:home_page_viewed`) || 0,
        signups: eventsMap.get(`${date}:signup_completed`) || 0,
        revenueCents: moneyItem?.revenueCents || 0,
      };
    });

    return {
      range: { startDate, endDate },
      timeseries,
    };
  },
};

export default analyticsService;
