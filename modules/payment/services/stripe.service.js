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
}) => {
  const returnBaseUrl = artistId
    ? `${process.env.FRONTEND_URL}/artist/${artistId}`
    : `${process.env.FRONTEND_URL}/payment`;

  return stripe.checkout.sessions.create({
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

    // success_url: `${process.env.FRONTEND_URL}/payment/success`,
    // cancel_url: `${process.env.FRONTEND_URL}/payment/cancel`,
    success_url: `${returnBaseUrl}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${returnBaseUrl}?payment=cancel`,
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
  stripePriceId
}) => {
  const returnBaseUrl = artistId
    ? `${process.env.FRONTEND_URL}/artist/${artistId}`
    : `${process.env.FRONTEND_URL}/subscription`;

  // 2️⃣ Create checkout session
  return stripe.checkout.sessions.create({
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

    // success_url: `${process.env.FRONTEND_URL}/subscription/success`,
    // cancel_url: `${process.env.FRONTEND_URL}/subscription/cancel`,
    success_url: `${returnBaseUrl}?subscription=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${returnBaseUrl}?subscription=cancel`,
  });
};
