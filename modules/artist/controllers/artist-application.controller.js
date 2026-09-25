import { artistApplicationService } from "../services/artist-application.service.js";
import { artistApplicationDTO } from "../dto/artist-application.dto.js";
import { artistApplicationPublicDTO } from "../dto/artist-application.dto.js"; // // optional
import { EmailService } from "../../email-services/email.service.js";

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
      } catch (_) {}
    }
    if (!Array.isArray(socials)) {
      socials = [];
    }

    const payload = {
      stageName: req.body.stageName,
      legalName: req.body.legalName,
      bio: req.body.bio,
      contact: req.body.contact,
      portfolioLink,
      socials,
      documents: [],
      samples: req.body.samples,
      country: req.body.country,
    };
    payload.documents.push({url:req.files.documents[0].location, filename:req.files.documents[0].key, docType:"gov_id"})

    // Business logic handled in service
    const application = await artistApplicationService.submit(userId, payload);

    // Trigger admin notification email to admin emails
    try {
      let parsedContact = payload.contact;
      if (typeof parsedContact === "string") {
        try {
          parsedContact = JSON.parse(parsedContact);
        } catch (_) {}
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
      } catch (_) {}
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
