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
    funnelId: {
      type: String,
      default: null,
      trim: true,
      index: true,
      sparse: true,
    },
    eventName: {
      type: String,
      required: true,
      enum: ALLOWED_EVENT_NAMES,
      index: true,
    },
    eventType: {
      type: String,
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
    timestamp: {
      type: Date,
      default: Date.now,
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
    planId: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    context: {
      type: contextSchema,
      default: () => ({}),
    },

    properties: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    strict: false,
  }
);

// Pre-save hook to ensure eventType/eventName and metadata/properties mirror each other
analyticsEventSchema.pre("validate", function (next) {
  if (!this.eventName && this.eventType) {
    this.eventName = this.eventType;
  }
  if (!this.eventType && this.eventName) {
    this.eventType = this.eventName;
  }
  if (!this.occurredAt && this.timestamp) {
    this.occurredAt = this.timestamp;
  }
  if (!this.timestamp && this.occurredAt) {
    this.timestamp = this.occurredAt;
  }
  if (this.metadata && (!this.properties || Object.keys(this.properties).length === 0)) {
    this.properties = this.metadata;
  } else if (this.properties && (!this.metadata || Object.keys(this.metadata).length === 0)) {
    this.metadata = this.properties;
  }
  next();
});

// Analytical compound indexes
analyticsEventSchema.index({ eventName: 1, occurredAt: -1 });
analyticsEventSchema.index({ artistId: 1, occurredAt: -1 });
analyticsEventSchema.index({ artistId: 1, eventType: 1, timestamp: -1 });
analyticsEventSchema.index({ funnelId: 1, timestamp: 1 });
analyticsEventSchema.index({ songId: 1, occurredAt: -1 });
analyticsEventSchema.index({ userId: 1, occurredAt: -1 });
analyticsEventSchema.index({ anonymousId: 1, occurredAt: -1 });

export const AnalyticsEvent =
  mongoose.models.AnalyticsEvent || mongoose.model("AnalyticsEvent", analyticsEventSchema);
