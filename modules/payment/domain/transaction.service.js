import mongoose from "mongoose";
import { Transaction } from "../../../models/Transaction.js";
import { EXCHANGE_RATES } from "../../../config/exchangeRates.js";
import { getNextInvoiceNumber } from "../../../utils/invoice.js";

export const markTransactionPaid = async ({
  gateway,
  paymentId,
  razorpayOrderId,
  paymentIntentId,
  stripeSubscriptionId,
  subscriptionId,
}) => {
  if (!gateway) {
    return { transaction: null, isFirstTime: false };
  }

  let query = {};

  // ----------------------------
  // 🔹 Build gateway-specific query
  // ----------------------------
  if (gateway === "stripe") {
    query = stripeSubscriptionId
      ? { stripeSubscriptionId }
      : { paymentIntentId };
  }

  if (gateway === "razorpay") {
    if (subscriptionId) {
      query = { "metadata.razorpaySubscriptionId": subscriptionId };
    } else if (razorpayOrderId) {
      query = { razorpayOrderId };
    } else if (paymentId) {
      query = { paymentId };
    }
  }

  if (gateway === "paypal") {
    query = subscriptionId
      ? { "metadata.paypalSubscriptionId": subscriptionId }
      : { paypalOrderId: paymentId };
  }

  // ❗ Compute exchange outside update
  const exchangeRate = EXCHANGE_RATES; // assume object
  const now = new Date();

  // ----------------------------
  // 🔥 ATOMIC UPDATE
  // ----------------------------
  const transaction = await Transaction.findOneAndUpdate(
    {
      ...query,
      status: "pending", // 🔴 idempotency guard
    },
    [
      {
        $set: {
          status: "paid",
          paidAt: now,

          invoiceNumber: getNextInvoiceNumber(), // ensure this is atomic-safe later

          exchangeRate: {
            $ifNull: [
              "$exchangeRate",
              exchangeRate["INR"], // adjust logic later if needed
            ],
          },

          exchangeRateSource: "static",
          exchangeRateAt: now,

          amountUSD: {
            $round: [
              {
                $multiply: ["$artistShare", exchangeRate["INR"]],
              },
              2,
            ],
          },
        },
      },
    ],
    {
      new: true,
    }
  );

  // ----------------------------
  // 🔁 If no update happened
  // ----------------------------
  if (!transaction) {
    return { transaction: null, isFirstTime: false };
  }

  // ----------------------------
  // ✅ Success
  // ----------------------------
  return {
    transaction,
    isFirstTime: true,
  };
};

export const findTransactionByPayload = async (payload) => {
  const {
    provider,
    paymentId,
    externalOrderId,
    externalSubscriptionId,
  } = payload;

  let query = {};

  if (provider === "razorpay") {
    if (externalSubscriptionId) {
      query = { "metadata.razorpaySubscriptionId": externalSubscriptionId };
    } else if (externalOrderId) {
      query = { razorpayOrderId: externalOrderId };
    } else if (paymentId) {
      query = { paymentId };
    }
  }

  if (provider === "stripe") {
    query = externalSubscriptionId
      ? { stripeSubscriptionId: externalSubscriptionId }
      : { paymentIntentId: paymentId };
  }

  return await Transaction.findOne(query);
};



export const validatePaymentIntegrity = (transaction, payload) => {
  // 🔴 Amount check
  if (transaction.amount !== payload.amount) {
    return false;
  }

  // 🔴 Currency check
  if (transaction.currency !== payload.currency) {
    return false;
  }

  // 🔴 Optional: item check
  if (
    payload.itemId &&
    transaction.itemId.toString() !== payload.itemId
  ) {
    return false;
  }

  return true;
};