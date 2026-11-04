import mongoose from "mongoose";
import { ArtistReferral } from "../models/artist-referral.model.js";
import { REFERRAL_CONSTANTS, REFERRAL_STATUS } from "../config/referral.constants.js";
import { creditArtistEarnings } from "../../artist-payout/services/artistEarningService.js";

/**
 * Stage 5: Referral Incentive Engine.
 * Evaluates qualified, unrewarded referrals for an artist.
 * For every 3 qualified referrals, credits $10 USD to the referrer's
 * balance & ledger via creditArtistEarnings.
 */
export const processReferralRewardService = async (referrerArtistId) => {
  if (!referrerArtistId) {
    return { rewardedBatches: 0, totalRewardedUSD: 0, remainingUnrewarded: 0 };
  }

  const { QUALIFIED_THRESHOLD, REWARD_AMOUNT_USD, REWARD_CURRENCY } = REFERRAL_CONSTANTS;
  let totalBatchesRewarded = 0;

  // Process eligible batches of 3 (FIFO by createdAt)
  while (true) {
    // 1. Find up to QUALIFIED_THRESHOLD unrewarded qualified referrals
    const unrewardedReferrals = await ArtistReferral.find({
      referrerArtistId,
      status: REFERRAL_STATUS.QUALIFIED,
      isRewarded: false,
    })
      .sort({ createdAt: 1 })
      .limit(QUALIFIED_THRESHOLD)
      .lean();

    // If fewer than threshold (3), referrer does not qualify for a new reward batch
    if (unrewardedReferrals.length < QUALIFIED_THRESHOLD) {
      break;
    }

    const batchIds = unrewardedReferrals.map((ref) => ref._id);
    const rewardBatchId = new mongoose.Types.ObjectId();
    const now = new Date();

    // 2. Atomically claim the batch to prevent concurrent race conditions
    const claimResult = await ArtistReferral.updateMany(
      {
        _id: { $in: batchIds },
        isRewarded: false,
      },
      {
        $set: {
          isRewarded: true,
          rewardedAt: now,
          rewardBatchId: rewardBatchId,
        },
      }
    );

    // If another concurrent request claimed any of these records, abort to prevent double payout
    if (claimResult.modifiedCount !== QUALIFIED_THRESHOLD) {
      console.warn(
        `⚠️ [Referral Reward] Concurrent modification detected for referrer ${referrerArtistId}. Claimed ${claimResult.modifiedCount}/${QUALIFIED_THRESHOLD}.`
      );
      if (claimResult.modifiedCount > 0) {
        await ArtistReferral.updateMany(
          { rewardBatchId: rewardBatchId },
          {
            $set: {
              isRewarded: false,
              rewardedAt: null,
              rewardBatchId: null,
            },
          }
        );
      }
      break;
    }

    // 3. Credit artist ledger and balance via artist payout service
    try {
      await creditArtistEarnings({
        artistId: referrerArtistId,
        transactionId: rewardBatchId,
        amount: REWARD_AMOUNT_USD,
        currency: REWARD_CURRENCY,
        source: "referral",
        amountUSD: REWARD_AMOUNT_USD,
        description: `Referral reward for ${QUALIFIED_THRESHOLD} qualified artist referrals`,
      });

      totalBatchesRewarded += 1;
      console.log(
        `🎉 [Referral Reward] Credited $${REWARD_AMOUNT_USD} ${REWARD_CURRENCY} to artist ${referrerArtistId} for batch ${rewardBatchId}.`
      );
    } catch (creditError) {
      console.error(
        `❌ [Referral Reward] Failed to credit earnings for batch ${rewardBatchId}. Rolling back referral claim:`,
        creditError
      );

      // Rollback referral claim so it can be retried safely
      await ArtistReferral.updateMany(
        { rewardBatchId: rewardBatchId },
        {
          $set: {
            isRewarded: false,
            rewardedAt: null,
            rewardBatchId: null,
          },
        }
      );
      throw creditError;
    }
  }

  const remainingUnrewarded = await ArtistReferral.countDocuments({
    referrerArtistId,
    status: REFERRAL_STATUS.QUALIFIED,
    isRewarded: false,
  });

  return {
    rewardedBatches: totalBatchesRewarded,
    totalRewardedUSD: totalBatchesRewarded * REWARD_AMOUNT_USD,
    remainingUnrewarded,
  };
};
