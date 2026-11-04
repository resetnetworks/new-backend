import { Artist } from "../../artist/models/artist.model.js";
import { ArtistReferral } from "../models/artist-referral.model.js";
import {
  generateReferralCode,
  REFERRAL_STATUS,
  REFERRAL_CONSTANTS,
} from "../config/referral.constants.js";
import { processReferralRewardService } from "./reward.service.js";
import { NotFoundError, ForbiddenError } from "../../../errors/index.js";

/*
 * Get or create an immutable referral code for an approved artist
 */
export const getOrCreateReferralCodeService = async (userId, userArtistId = null) => {
  // 1. Locate artist profile
  let artist = null;

  if (userArtistId) {
    artist = await Artist.findOne({ _id: userArtistId, isDeleted: false });
  }

  if (!artist) {
    artist = await Artist.findOne({ createdBy: userId, isDeleted: false });
  }

  if (!artist) {
    throw new NotFoundError(
      "Artist profile not found. You must be an artist to access the referral program."
    );
  }

  if (artist.approvalStatus !== "approved") {
    throw new ForbiddenError(
      "Your artist application must be approved before you can participate in the referral program."
    );
  }

  const frontendBase = process.env.FRONTEND_URL || "https://musicreset.com";

  // 2. Return existing immutable referral code if already present
  if (artist.referralCode) {
    return {
      artistId: artist._id,
      artistName: artist.name,
      referralCode: artist.referralCode,
      referralLink: `${frontendBase}/artist/register/apply?ref=${artist.referralCode}`,
      isNew: false,
    };
  }

  // 3. Generate a collision-free referral code (e.g. ARTIST_4821)
  let attempts = 0;
  let code = "";
  let isUnique = false;

  while (!isUnique && attempts < 10) {
    code = generateReferralCode(artist.name);
    const existing = await Artist.exists({ referralCode: code });
    if (!existing) {
      isUnique = true;
    }
    attempts++;
  }

  if (!isUnique) {
    code = generateReferralCode(`${artist.name}${Date.now().toString().slice(-3)}`);
  }

  artist.referralCode = code;
  await artist.save();

  return {
    artistId: artist._id,
    artistName: artist.name,
    referralCode: artist.referralCode,
    referralLink: `${frontendBase}/artist/register/apply?ref=${artist.referralCode}`,
    isNew: true,
  };
};

/*
 * Stage 3: Record first song or album upload for a referred artist
 * Marks content upload complete and transitions status to qualified
 */
export const recordFirstContentUploadService = async ({
  artistId,
  userId = null,
  contentId,
  contentType = "song",
}) => {
  if (!artistId && !userId) return null;

  const query = {
    $or: [
      ...(artistId ? [{ refereeArtistId: artistId }] : []),
      ...(userId ? [{ refereeUserId: userId }] : []),
    ],
    status: REFERRAL_STATUS.IN_PROGRESS,
  };

  const referral = await ArtistReferral.findOne(query);

  if (!referral) {
    return null; // Not referred, or already qualified/rejected
  }

  // If already marked as uploaded, do not overwrite
  if (referral.stage3_contentUploaded?.status) {
    return referral;
  }

  const now = new Date();

  referral.stage3_contentUploaded = {
    status: true,
    contentId,
    contentType,
    completedAt: now,
  };

  // Stage 4: Content approved (auto-completed for now until manual verification exists)
  referral.stage4_contentApproved = {
    status: true,
    completedAt: now,
  };

  if (!referral.refereeArtistId && artistId) {
    referral.refereeArtistId = artistId;
  }

  referral.status = REFERRAL_STATUS.QUALIFIED;
  await referral.save();

  console.log(
    `🎯 [Referral] Referee (${artistId || userId}) uploaded first ${contentType} (${contentId}). Referral ${referral._id} is now QUALIFIED.`
  );

  // Stage 5: Evaluate referral incentive for referrer (every 3 qualified = $10 USD)
  try {
    if (referral.referrerArtistId) {
      await processReferralRewardService(referral.referrerArtistId);
    }
  } catch (rewardErr) {
    console.error(
      `⚠️ [Referral Reward Error] Failed processing reward for referrer ${referral.referrerArtistId}:`,
      rewardErr
    );
  }

  return referral;
};

/*
 * Get referrals list and status tracking for the logged-in referrer artist
 */
export const getMyReferralsService = async (userId, userArtistId = null) => {
  let artist = null;

  if (userArtistId) {
    artist = await Artist.findOne({ _id: userArtistId, isDeleted: false });
  }

  if (!artist) {
    artist = await Artist.findOne({ createdBy: userId, isDeleted: false });
  }

  if (!artist) {
    throw new NotFoundError(
      "Artist profile not found. You must be an artist to view referrals."
    );
  }

  // Self-heal / reconcile any pending reward batches of 3
  try {
    await processReferralRewardService(artist._id);
  } catch (reconcileErr) {
    console.error(
      `⚠️ [Referral Reward Reconcile] Error checking rewards for artist ${artist._id}:`,
      reconcileErr
    );
  }

  const referrals = await ArtistReferral.find({ referrerArtistId: artist._id })
    .populate("refereeUserId", "name email")
    .populate("refereeArtistId", "name slug")
    .populate("refereeApplicationId", "stageName legalName country")
    .sort({ createdAt: -1 })
    .lean();

  const formattedReferrals = referrals.map((ref) => {
    const refereeName =
      ref.refereeArtistId?.name ||
      ref.refereeApplicationId?.stageName ||
      ref.refereeUserId?.name ||
      "New Artist";

    // Stage 1: Applied (code used)
    const stage1 = {
      completed: Boolean(ref.stage1_codeApplied?.status ?? true),
      completedAt: ref.stage1_codeApplied?.completedAt || ref.createdAt,
    };

    // Stage 2: Artist Application Approved
    const stage2 = {
      completed: Boolean(ref.stage2_artistApproved?.status),
      completedAt: ref.stage2_artistApproved?.completedAt || null,
    };

    // Stage 3: Song / Album Uploaded
    const stage3 = {
      completed: Boolean(ref.stage3_contentUploaded?.status),
      contentType: ref.stage3_contentUploaded?.contentType || null,
      contentId: ref.stage3_contentUploaded?.contentId || null,
      completedAt: ref.stage3_contentUploaded?.completedAt || null,
    };

    // Stage 4: Content Approved (Auto-verified)
    const stage4 = {
      completed: Boolean(ref.stage4_contentApproved?.status),
      completedAt: ref.stage4_contentApproved?.completedAt || null,
    };

    let currentStage = 1;
    if (stage3.completed) {
      currentStage = 3; // 3 of 3 steps complete (Qualified)
    } else if (stage2.completed) {
      currentStage = 2;
    }

    return {
      id: ref._id,
      refereeName,
      refereeArtistSlug: ref.refereeArtistId?.slug || null,
      referralCode: ref.referralCode,
      status: ref.status,
      currentStage,
      stage1_applied: stage1,
      stage2_artistApproved: stage2,
      stage3_contentUploaded: stage3,
      stage4_contentApproved: stage4,
      isRewarded: ref.isRewarded,
      rewardedAt: ref.rewardedAt,
      rewardBatchId: ref.rewardBatchId || null,
      createdAt: ref.createdAt,
    };
  });

  const totalInvited = referrals.length;
  const inProgressCount = referrals.filter(
    (r) => r.status === REFERRAL_STATUS.IN_PROGRESS
  ).length;
  const qualifiedCount = referrals.filter(
    (r) => r.status === REFERRAL_STATUS.QUALIFIED
  ).length;
  const rewardedCount = referrals.filter((r) => r.isRewarded).length;
  const unrewardedQualifiedCount = referrals.filter(
    (r) => r.status === REFERRAL_STATUS.QUALIFIED && !r.isRewarded
  ).length;

  return {
    stats: {
      totalInvited,
      inProgressCount,
      qualifiedCount,
      rewardedCount,
      unrewardedQualifiedCount,
      totalEarnedUSD:
        Math.floor(rewardedCount / REFERRAL_CONSTANTS.QUALIFIED_THRESHOLD) *
        REFERRAL_CONSTANTS.REWARD_AMOUNT_USD,
      threshold: REFERRAL_CONSTANTS.QUALIFIED_THRESHOLD,
      rewardAmountUSD: REFERRAL_CONSTANTS.REWARD_AMOUNT_USD,
    },
    referrals: formattedReferrals,
  };
};
