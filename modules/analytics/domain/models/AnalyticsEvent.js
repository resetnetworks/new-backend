// modules/analytics/domain/models/AnalyticsEvent.js
import mongoose from "mongoose";
import { ALLOWED_DEVICE_TYPES, ALLOWED_PLATFORMS, DEFAULT_EVENT_VERSION } from "../analytics.constants.js";
import { ALLOWED_EVENT_NAMES } from "../event.types.js";

const contextSchema = new mongoose.Schema(
  {
    country: { type: String, default: null, trim: true },
    region: { type: String, default: null, trim: true },
    city: { type: String, default: null, trim: true },
    deviceType: {
      type: String,
      enum: ALLOWED_DEVICE_TYPES,
      default: "unknown",
    },
    operatingSystem: { type: String, default: null, trim: true },
    browser: { type: String, default: null, trim: true },
    platform: {
      type: String,
      enum: ALLOWED_PLATFORMS,
      default: "web",
    },
    ipHash: { type: String, default: null },
  },
  { _id: false }
);

const analyticsEventSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    eventName: {
      type: String,
      required: true,
      enum: ALLOWED_EVENT_NAMES,
      index: true,
    },
    eventVersion: {
      type: Number,
      default: DEFAULT_EVENT_VERSION,
    },
    occurredAt: {
      type: Date,
      required: true,
      index: true,
    },
    receivedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    // Identity
    anonymousId: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    sessionId: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },

    // Associated Entities
    songId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Song",
      default: null,
      index: true,
    },
    albumId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Album",
      default: null,
    },
    artistId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Artist",
      default: null,
      index: true,
    },

    context: {
      type: contextSchema,
      default: () => ({}),
    },

    properties: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    strict: true,
  }
);

// High-utility compound indexes for analytical queries
analyticsEventSchema.index({ eventName: 1, occurredAt: -1 });
analyticsEventSchema.index({ artistId: 1, occurredAt: -1 });
analyticsEventSchema.index({ songId: 1, occurredAt: -1 });
analyticsEventSchema.index({ userId: 1, occurredAt: -1 });
analyticsEventSchema.index({ anonymousId: 1, occurredAt: -1 });

export const AnalyticsEvent = mongoose.model("AnalyticsEvent", analyticsEventSchema);
