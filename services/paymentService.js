import { Transaction } from "../models/Transaction.js";
import { User } from "../models/User.js";
import { Subscription } from "../models/Subscription.js";
import { getNextInvoiceNumber } from "../utils/invoiceNumber.js";
import mongoose from "mongoose";
import { creditArtistEarnings } from "../modules/artist-payout/services/artistEarningService.js";
import { EXCHANGE_RATES } from "../utils/priceInUSD.js";
import buildQuery from "../utils/buildQuery .js"
import logger  from "../utils/logger.js"
const subscriptionDuration = {
  "1m": 30,   // 30 days
  "3m": 90,   // 90 days
  "6m": 180   // 180 days
};


export const markTransactionPaid = async (payload) => {
  try {
    const query = buildQuery(payload);

    // ----------------------------
    // 1️⃣ Atomic update (core payment state)
    // ----------------------------
    const transaction = await Transaction.findOneAndUpdate(
      {
        ...query,
        status: { $ne: "paid" }, // 🔥 concurrency + idempotency guard
      },
      {
        $set: {
          status: "paid",
          paidAt: new Date(),
        },
      },
      { new: true }
    );

    // ----------------------------
    // 2️⃣ Not found OR already processed
    // ----------------------------
    if (!transaction) {
      logger.warn({ payload }, "Duplicate or missing transaction");
      return { transaction: null, isFirstTime: false };
    }

    // ----------------------------
    // 3️⃣ Financial calculations (non-critical but important)
    // ----------------------------
    const rate = EXCHANGE_RATES[transaction.currency];

    if (!rate) {
      throw new Error(`Unsupported currency: ${transaction.currency}`);
    }

    const amountUSD = Number(
      (transaction.artistShare * rate).toFixed(2)
    );

    // ----------------------------
    // 4️⃣ Safe update (post-processing)
    // ----------------------------
    await Transaction.updateOne(
      { _id: transaction._id },
      {
        $set: {
          amountUSD,
          exchangeRate: rate,
          exchangeRateSource: "static",
          exchangeRateAt: new Date(),
        },
      }
    );

    // ----------------------------
    // 5️⃣ Return contract
    // ----------------------------
    return {
      transaction: {
        ...transaction.toObject(),
        amountUSD,
      },
      isFirstTime: true,
    };

  } catch (err) {
    logger.error(
      {
        error: err.message,
        stack: err.stack,
        payload,
      },
      "markTransactionPaid failed"
    );
    throw err;
  }
};


// ✅ Update user after payment
export const updateUserAfterPurchase = async (transaction, paymentId) => {
  const updateOps = {};

  // ----------------------------
  // 🧾 Purchase history (best-effort)
  // ----------------------------
  updateOps.$push = {
    purchaseHistory: {
      itemType: transaction.itemType,
      itemId: transaction.itemId,
      price: transaction.amount,
      currency: transaction.currency,
      paymentId,
    },
  };

  // ----------------------------
  // 🎵 Item unlock
  // ----------------------------
  switch (transaction.itemType) {
    case "song":
      updateOps.$addToSet = { purchasedSongs: transaction.itemId };
      break;

    case "album":
      updateOps.$addToSet = { purchasedAlbums: transaction.itemId };
      break;

    case "artist-subscription": {
      const daysToAdd =
        subscriptionDuration[transaction.metadata?.cycle] || 30;

      const externalSubscriptionId =
        transaction.metadata?.razorpaySubscriptionId ||
        transaction.stripeSubscriptionId ||
        transaction.metadata?.paypalSubscriptionId;

      if (!externalSubscriptionId) {
        logger.error(
          { transactionId: transaction._id },
          "Missing externalSubscriptionId"
        );
        break;
      }

      // 🔥 fetch existing
      const existing = await Subscription.findOne({
        externalSubscriptionId,
      });

      const now = new Date();
      const baseDate =
        existing?.validUntil > now ? existing.validUntil : now;

      const validUntil = new Date(
        baseDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000
      );

      await Subscription.findOneAndUpdate(
        { externalSubscriptionId },
        {
          userId: transaction.userId,
          artistId: transaction.artistId,
          status: "active",
          validUntil,
          gateway: transaction.gateway,
          transactionId: transaction._id,
        },
        { upsert: true, new: true }
      );

      logger.info(
        { artistId: transaction.artistId },
        "Subscription created/updated"
      );

      break;
    }

    default:
      logger.warn(
        { itemType: transaction.itemType },
        "Unknown itemType"
      );
  }

  // ----------------------------
  // 👤 Update user
  // ----------------------------
  const user = await User.findByIdAndUpdate(
    transaction.userId,
    updateOps,
    { new: true }
  );

  if (!user) {
    logger.warn(
      { transactionId: transaction._id },
      "User not found"
    );
    return false;
  }

  logger.info(
    { userId: user._id },
    "User updated after purchase"
  );

  return true;
};

