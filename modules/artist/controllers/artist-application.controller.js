import slugify from "slugify";
import { customAlphabet } from "nanoid";
import { artistApplicationService } from "../services/artist-application.service.js";
import { artistApplicationDTO } from "../dto/artist-application.dto.js";
import { artistApplicationPublicDTO } from "../dto/artist-application.dto.js"; // // optional
import { EmailService } from "../../email-services/email.service.js";
import { eventDispatcher, EVENT_TYPES } from "../../analytics/index.js";

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 6);

/**
 * POST /api/v2/artist/apply
 * User submits artist application
 */
export const submitArtistApplicationController = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const portfolioLink = req.body.portfolioLink || "";
    let socials = req.body.socials;
    if (typeof socials === "string") {
      try {
        socials = JSON.parse(socials);
      } catch (_) { }
    }
    if (!Array.isArray(socials)) {
      socials = [];
    }

    // Parse contact info
    let contact = req.body.contact || {};
    if (typeof contact === "string") {
      try {
        contact = JSON.parse(contact);
      } catch (_) { }
    }
    if (typeof contact !== "object" || contact === null) {
      contact = {};
    }
    if (req.body["contact[email]"]) {
      contact.email = req.body["contact[email]"];
    }
    if (req.body["contact[phone]"]) {
      contact.phone = req.body["contact[phone]"];
    }
    if (req.body["contact[website]"]) {
      contact.website = req.body["contact[website]"];
    }
    if (!contact.email && req.user?.email) {
      contact.email = req.user.email;
    }

    // Parse documents
    let documents = [];
    if (Array.isArray(req.body.documents)) {
      documents = [...req.body.documents];
    } else if (typeof req.body.documents === "string") {
      try {
        const parsed = JSON.parse(req.body.documents);
        if (Array.isArray(parsed)) documents = [...parsed];
      } catch (_) { }
    }

    // Process files uploaded via multipart/form-data
    if (req.files?.documents) {
      const docFiles = Array.isArray(req.files.documents)
        ? req.files.documents
        : [req.files.documents];

      docFiles.forEach((file, index) => {
        const docType =
          req.body[`documentTypes[${index}]`] ||
          req.body.documentType ||
          "gov_id";
        documents.push({
          url:
            file.location ||
            file.path ||
            `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION || "ap-south-1"}.amazonaws.com/${file.key}`,
          filename: file.key || file.originalname,
          size: file.size,
          mimeType: file.mimetype,
          docType: ["gov_id", "proof_of_address", "tax_id", "portfolio", "other"].includes(docType)
            ? docType
            : "gov_id",
          uploadedAt: new Date(),
        });
      });
    }

    let samples = req.body.samples;
    if (typeof samples === "string") {
      try {
        samples = JSON.parse(samples);
      } catch (_) { }
    }
    if (!Array.isArray(samples)) {
      samples = [];
    }

    const stageName = req.body.stageName?.trim();
    let slug = req.body.slug?.trim();
    if (!slug && stageName) {
      const baseSlug = slugify(stageName, { lower: true, strict: true }) || "artist";
      slug = `${baseSlug}-${nanoid()}`;
    }

    const payload = {
      stageName,
      slug,
      legalName: req.body.legalName?.trim(),
      bio: req.body.bio?.trim(),
      contact,
      portfolioLink,
      socials,
      documents,
      samples,
      country: req.body.country?.trim()?.toUpperCase(),
      documents: req.body.documents || [],
      samples: req.body.samples,
      country: req.body.country,
      referralCode: req.body.referralCode || req.query.ref || null,
    };

    // Business logic handled in service
    const application = await artistApplicationService.submit(userId, payload);

    // Trigger admin notification email to admin emails
    try {
      let parsedContact = payload.contact;
      if (typeof parsedContact === "string") {
        try {
          parsedContact = JSON.parse(parsedContact);
        } catch (_) { }
      }

      const adminEmails = ["info@reset93.net", "info@musicreset.com"];

      await Promise.all(
        adminEmails.map((email) =>
          EmailService.sendArtistApplicationSubmitted({
            userId,
            toEmail: email,
            applicantName: req.user?.name,
            applicantEmail: req.user?.email,
            stageName: payload.stageName,
            legalName: payload.legalName,
            bio: payload.bio,
            country: payload.country,
            contact: parsedContact,
            portfolioLink: payload.portfolioLink || "",
            socials: payload.socials,
            applicationId: application._id,
            submittedAt: application.createdAt || new Date(),
          })
        )
      );
      console.log(`📨 Artist application admin notification emails queued for: ${adminEmails.join(", ")}`);
    } catch (emailErr) {
      console.error("⚠️ Failed to queue artist application admin notification email:", emailErr);
    }

    // 📊 Non-blocking analytics: ARTIST_APPLICATION_SUBMITTED
    eventDispatcher.publish({
      eventName: EVENT_TYPES.ARTIST_APPLICATION_SUBMITTED,
      userId,
      properties: {
        applicationId: application._id,
        stageName: payload.stageName,
        legalName: payload.legalName,
        country: payload.country,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Artist application submitted successfully.",
      application: artistApplicationDTO(application),
    });
  } catch (err) {
    next(err);
  }
};


/**
 * GET /api/v2/artist/application/me
 * Retrieve the logged-in user's artist application
 */
export const getMyArtistApplicationController = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const application = await artistApplicationService.getMyApplication(userId);

    return res.status(200).json({
      success: true,
      application: artistApplicationDTO(application),
    });
  } catch (err) {
    next(err);
  }
};





export const updateMyArtistApplicationController = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const portfolioLink = req.body.portfolioLink;
    let socials = req.body.socials;
    if (typeof socials === "string") {
      try {
        socials = JSON.parse(socials);
      } catch (_) { }
    }

    const updates = {
      stageName: req.body.stageName,
      legalName: req.body.legalName,
      bio: req.body.bio,
      contact: req.body.contact,
      portfolioLink,
      socials,
      documents: req.body.documents,
      samples: req.body.samples,
      requestedUploadQuotaBytes: req.body.requestedUploadQuotaBytes,
    };

    // remove undefined keys
    Object.keys(updates).forEach((k) => updates[k] === undefined && delete updates[k]);

    const { updatedApplication } = await artistApplicationService.updateApplicationByUser(
      userId,
      updates
    );

    return res.status(200).json({
      success: true,
      message: "Application updated and resubmitted for review.",
      application: artistApplicationPublicDTO(updatedApplication),
    });
  } catch (err) {
    next(err);
  }
};
