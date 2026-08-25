import { User } from "../../../models/User.js";
import { Artist } from "../../artist/models/artist.model.js";

/**
 * Artist Application Admin DTO
 * -------------------------------------------------------
 * Admin sees more details than normal users:
 *  ✔ documents (full data)
 *  ✔ tax info
 *  ✔ attemptCount
 *  ✔ adminNotes
 *  ✔ adminReviewer
 *  ✔ reviewedAt
 *  ✔ isDocsComplete
 *
 * Still DO NOT expose:
 *  - internal Mongo fields
 *  - IP address (optional)
 *  - userAgent (optional)
 */
export const artistApplicationAdminDTO = async (app) => {
  if (!app) return null;

  const user = await User.findById(app.userId).select("name email phone").lean();
  const artist = await Artist.findOne({ createdBy: app.userId }).select("country bio").lean();

  return {
    id: app._id,
    userId: app.userId,
    user: user ? { name: user.name, email: user.email, phone: user.phone } : null,
    stageName: app.stageName,
    legalName: app.legalName || null,
    slug: app.slug,
    bio: artist?.bio || app.bio || "",

    contact: app.contact || {},
    country: artist?.country || app.country || null,
    location: artist?.country || app.country || null,

    socials: Array.isArray(app.socials)
      ? app.socials.map((s) => ({
        provider: s.provider,
        url: s.url,
      }))
      : [],

    documents: Array.isArray(app.documents)
      ? app.documents.map((d) => ({
        url: d.url,
        filename: d.filename,
        size: d.size || null,
        mimeType: d.mimeType || null,
        docType: d.docType,
        uploadedAt: d.uploadedAt,
      }))
      : [],

    samples: Array.isArray(app.samples)
      ? app.samples.map((s) => ({
        title: s.title,
        url: s.url,
        duration: s.durationSeconds || null,
      }))
      : [],

    // Tax info (admin-only)
    taxInfo: app.taxInfo
      ? {
        pan: app.taxInfo.pan || null,
        gstin: app.taxInfo.gstin || null,
        businessName: app.taxInfo.businessName || null,
      }
      : null,

    status: app.status,
    attemptCount: app.attemptCount,

    // Admin review metadata
    adminNotes: app.adminNotes || null,
    adminReviewer: app.adminReviewer || null,
    reviewedAt: app.reviewedAt || null,

    // Optional internal flags
    isDocsComplete: app.isDocsComplete,
    isKycPassed: app.isKycPassed,

    createdAt: app.createdAt,
    updatedAt: app.updatedAt,
  };
};
