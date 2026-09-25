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
  // amount,
  // currency,
  userId,
  artistId,
  cycle,
  transactionId,
  stripeCustomerId,
  stripePriceId,
  customReturnUrl,
}) => {
  const returnBaseUrl = customReturnUrl
    ? customReturnUrl
    : artistId
    ? `${process.env.FRONTEND_URL}/artist/${artistId}`
    : `${process.env.FRONTEND_URL}/subscription`;

  const separator = returnBaseUrl.includes("?") ? "&" : "?";
  const returnUrl = `${returnBaseUrl}${separator}subscription=return&session_id={CHECKOUT_SESSION_ID}`;

  // 2️⃣ Create checkout session
  return stripe.checkout.sessions.create({
    ui_mode: "embedded",
    mode: "subscription",

    // payment_method_types: ["card"], // Stripe auto-detects available methods for the customer, so this is optional
    customer: stripeCustomerId,

    line_items: [
      {
        // price: price.id,
        price: stripePriceId, // Use the ID passed from the controller
        quantity: 1,
      },
    ],

    metadata: {
      transactionId,
      userId,
      artistId,
      cycle,
      itemType: "artist-subscription",
    },

    subscription_data: {
      metadata: {
        transactionId,
        userId,
        artistId,
        cycle,
      },
    },

    return_url: returnUrl,
  });
};

export const retrieveCheckoutSession = async (sessionId) => {
  return stripe.checkout.sessions.retrieve(sessionId);
};
