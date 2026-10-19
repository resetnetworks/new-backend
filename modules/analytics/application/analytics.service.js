// modules/analytics/application/analytics.service.js
import mongoose from "mongoose";
import { eventDispatcher } from "./eventDispatcher.js";
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
   * Tracks multiple events in batch
   */
  async trackBatch(events = []) {
    return eventDispatcher.publishBatch(events);
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
          eventName: { $in: ["artist_viewed", "album_viewed", "song_viewed"] },
          occurredAt: { $gte: startDateTime, $lte: endDateTime },
        },
      },
      {
        $group: {
          _id: "$eventName",
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

    // 1. Daily artist stats (plays, qualifiedPlays, revenue, followers, likes)
    const dailyStats = await ArtistDailyStats.find({
      artistId: artistObjectId,
      date: { $gte: startDate, $lte: endDate },
    }).lean();

    const dailyStatsMap = new Map();
    for (const stat of dailyStats) {
      dailyStatsMap.set(stat.date, stat);
    }

    // 2. Daily completions & skips from SongDailyStats
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

    // 3. Daily traffic events (views)
    const dailyTrafficEvents = await AnalyticsEvent.aggregate([
      {
        $match: {
          artistId: artistObjectId,
          eventName: { $in: ["artist_viewed", "album_viewed", "song_viewed"] },
          occurredAt: { $gte: startDateTime, $lte: endDateTime },
        },
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$occurredAt" } },
            eventName: "$eventName",
          },
          count: { $sum: 1 },
        },
      },
    ]);

    const trafficMap = new Map();
    for (const item of dailyTrafficEvents) {
      trafficMap.set(`${item._id.date}:${item._id.eventName}`, item.count);
    }

    // Generate unbroken sequence of dates
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

    // 1. Platform-wide traffic & funnel events
    const platformEventsAgg = await AnalyticsEvent.aggregate([
      {
        $match: {
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
          occurredAt: { $gte: startDateTime, $lte: endDateTime },
        },
      },
      {
        $group: {
          _id: "$eventName",
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

    // 2. Platform-wide playback metrics
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

    // 3. Platform-wide monetization metrics
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

    // 4. Platform entity totals
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

    // 1. Daily streaming volume from SongDailyStats
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

    // 2. Daily monetization from ArtistDailyStats
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

    // 3. Daily traffic & signups from AnalyticsEvent
    const dailyEvents = await AnalyticsEvent.aggregate([
      {
        $match: {
          eventName: {
            $in: ["landing_page_viewed", "home_page_viewed", "signup_completed"],
          },
          occurredAt: { $gte: startDateTime, $lte: endDateTime },
        },
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$occurredAt" } },
            eventName: "$eventName",
          },
          count: { $sum: 1 },
        },
      },
    ]);

    const eventsMap = new Map();
    for (const item of dailyEvents) {
      eventsMap.set(`${item._id.date}:${item._id.eventName}`, item.count);
    }

    // Unbroken sequence of dates
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

