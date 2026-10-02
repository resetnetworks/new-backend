import { stripe } from "../providers/stripe.client.js";
import { cycleToInterval } from "../../../utils/cycleToInterval.js";
import { formatAmount } from "../utils/formatCurrencies.js";

export const createCheckoutSession = async ({
  amount,
  currency,
  userId,
  artistId,
  itemId,
  itemType,
  transactionId,
  stripeCustomerId,
  customReturnUrl,
}) => {
  const returnBaseUrl = customReturnUrl
    ? customReturnUrl
    : artistId
    ? `${process.env.FRONTEND_URL}/artist/${artistId}`
    : `${process.env.FRONTEND_URL}/payment`;

  const separator = returnBaseUrl.includes("?") ? "&" : "?";
  const returnUrl = `${returnBaseUrl}${separator}payment=return&session_id={CHECKOUT_SESSION_ID}`;

  return stripe.checkout.sessions.create({
    ui_mode: "embedded",
    mode: "payment",

    payment_method_types: ["card"],

    customer: stripeCustomerId, // optional but recommended

    line_items: [
      {
        price_data: {
          currency,
          product_data: {
            name: `${itemType} purchase`,
          },
          unit_amount: formatAmount(amount, currency),
        },
        quantity: 1,
      },
    ],

    metadata: {
      transactionId,
      userId,
      artistId: artistId || "",
      itemId,
      itemType,
    },

    payment_intent_data: {
      metadata: {
        transactionId,
        userId,
        artistId: artistId || "",
        itemId,
      },
    },

    return_url: returnUrl,
  });
};


export const createSubscriptionCheckoutSession = async ({
  userId,
  artistId,
  cycle,
  transactionId,
  stripeCustomerId,
  stripePriceId,
  customReturnUrl,
  isTrial = false,
  trialDays = 1,
}) => {
  const returnBaseUrl = customReturnUrl
    ? customReturnUrl
    : artistId
    ? `${process.env.FRONTEND_URL}/artist/${artistId}`
    : `${process.env.FRONTEND_URL}/subscription`;

  const separator = returnBaseUrl.includes("?") ? "&" : "?";
  const successUrl = `${returnBaseUrl}${separator}subscription=success&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${returnBaseUrl}${separator}subscription=cancel`;

  const sessionParams = {
    mode: "subscription",
    customer: stripeCustomerId,
    line_items: [
      {
        price: stripePriceId,
        quantity: 1,
      },
    ],
    metadata: {
      transactionId,
      userId,
      artistId,
      cycle,
      itemType: "artist-subscription",
      isTrial: isTrial ? "true" : "false",
    },
    subscription_data: {
      metadata: {
        transactionId,
        userId,
        artistId,
        cycle,
        isTrial: isTrial ? "true" : "false",
      },
    },
    success_url: successUrl,
    cancel_url: cancelUrl,
  };

  if (isTrial) {
    sessionParams.subscription_data.trial_period_days = trialDays;
  }

  return stripe.checkout.sessions.create(sessionParams);
};

export const retrieveCheckoutSession = async (sessionId) => {
  return stripe.checkout.sessions.retrieve(sessionId);
};
