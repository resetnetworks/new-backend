import { stripe } from "../providers/stripe.client.js";
import { cycleToInterval } from "../../../utils/cycleToInterval.js";
import { formatAmount } from "../utils/formatCurrencies.js";

export const createCheckoutSession = async ({
  amount,
  currency,
  userId,
  itemId,
  itemType,
  transactionId,
  stripeCustomerId,
}) => {
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
      itemId,
      itemType,
    },

    payment_intent_data: {
      metadata: {
        transactionId,
        userId,
        itemId,
      },
    },

    success_url: `${process.env.FRONTEND_URL}/payment/success`,
    cancel_url: `${process.env.FRONTEND_URL}/payment/cancel`,
  });
};


export const createSubscriptionCheckoutSession = async ({
  amount,
  currency,
  userId,
  artistId,
  cycle,
  transactionId,
  stripeCustomerId,
}) => {
  const interval = cycleToInterval(cycle).stripe;

  // 1️⃣ Create price
  const price = await stripe.prices.create({
    unit_amount: formatAmount(amount, currency),
    currency: currency.toLowerCase(),
    recurring: interval,
    product_data: {
      name: "Artist Subscription",
    },
  });

  // 2️⃣ Create checkout session
  return stripe.checkout.sessions.create({
    mode: "subscription",

    // payment_method_types: ["card"], // Stripe auto-detects available methods for the customer, so this is optional
    customer: stripeCustomerId,

    line_items: [
      {
        price: price.id,
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

    success_url: `${process.env.FRONTEND_URL}/subscription/success`,
    cancel_url: `${process.env.FRONTEND_URL}/subscription/cancel`,
  });
};
