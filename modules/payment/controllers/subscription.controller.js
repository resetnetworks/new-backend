import { StatusCodes } from "http-status-codes";
import { createSubscriptionCheckoutSession } from "../services/stripe.service.js";
import { Transaction } from "../../../models/Transaction.js";
import { Subscription } from "../../../models/Subscription.js";
import { Artist } from "../../../models/Artist.js";
import { getOrCreateStripeCustomer } from "../../../utils/stripe.js";
import { User } from "../../../models/User.js";

const PLATFORM_FEE_PERCENT = 0.15;
const ALLOWED_CURRENCIES = ["USD", "EUR", "GBP", "JPY", "INR"];
const ZERO_DECIMAL_CURRENCIES = ["JPY", "KRW", "VND", "HUF"];


export const createSubscriptionCheckout = async (req, res) => {
  try {
    const { artistId, cycle, currency = "USD", returnUrl } = req.body;
    const user = req.user;

    if (!artistId || !cycle) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: "artistId and cycle are required",
      });
    }

    // 1️⃣ Prevent duplicate active/trialing subscription
    const existingSubscription = await Subscription.findOne({
      userId: user._id,
      artistId,
      status: { $in: ["active", "trialing"] },
      validUntil: { $gt: new Date() },
    });

    if (existingSubscription) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: "Subscription already active or in trial.",
      });
    }

    // ✅ Check if trial was already used for this artist by this user
    const existingTrial = await Subscription.findOne({
      userId: user._id,
      artistId,
      isTrialUsed: true,
    });

    // 🎯 First time subscribing to this artist -> ALWAYS free trial (2 days)
    // After trial period ends, user will be auto-charged by Stripe.
    let isTrial = false;
    if (!existingTrial) {
      isTrial = true;
    } else if (req.body.isTrial) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: "Free trial already claimed for this artist. Please choose a paid subscription.",
      });
    }

    const trialDays = parseInt(process.env.DEFAULT_TRIAL_PERIOD_DAYS, 10) || 1;

    const artist = await Artist.findById(artistId);

    if (!artist || !artist.subscriptionPlans?.length) {
      return res.status(StatusCodes.NOT_FOUND).json({
        message: "Subscription not available for this artist",
      });
    }

    // 🔎 Find matching cycle plan
    const plan = artist.subscriptionPlans.find(
      (p) => p.cycle === cycle
    );

    if (!plan || !plan.basePrice?.amount) {
      return res.status(StatusCodes.NOT_FOUND).json({
        message: "Subscription plan not found for this cycle",
      });
    }

    // ✅ SIMPLIFIED CURRENCY LOGIC WITH FALLBACK
    const requestedCurrency = currency.toUpperCase();
    let selectedCurrency = ALLOWED_CURRENCIES.includes(requestedCurrency) ? requestedCurrency : plan.basePrice.currency;

    // Find matching price in DB
    let priceEntry =
      selectedCurrency === plan.basePrice.currency
        ? plan.basePrice
        : plan.convertedPrices?.find((p) => p.currency === selectedCurrency);

    if (!priceEntry) {
      selectedCurrency = plan.basePrice.currency;
      priceEntry = plan.basePrice;
    }

    const amount = priceEntry.amount;

    // 3️⃣ Calculate platform fee
    const isZeroDecimal = ZERO_DECIMAL_CURRENCIES.includes(selectedCurrency);

    let platformFee;
    let artistShare;

    if (isZeroDecimal) {
      platformFee = Math.round(amount * PLATFORM_FEE_PERCENT);
      artistShare = amount - platformFee;
    } else {
      platformFee = Number((amount * PLATFORM_FEE_PERCENT).toFixed(2));
      artistShare = Number((amount - platformFee).toFixed(2));
    }

    // 4️⃣ Create pending transaction
    const transaction = await Transaction.create({
      userId: user._id,
      artistId,
      itemId: artistId,
      itemType: "artist-subscription",
      gateway: "stripe",
      amount: isTrial ? 0 : amount,
      currency: selectedCurrency,
      status: "pending",
      platformFee: isTrial ? 0 : platformFee,
      artistShare: isTrial ? 0 : artistShare,
      isTrialPeriod: isTrial,
    });

    // 5️⃣ Get Stripe customer
    const stripeCustomerId = await getOrCreateStripeCustomer(user);

    // 👉 Find matching stripe plan for the selected currency or fallback
    let stripePlan = plan.stripePlans?.find((sp) => sp.currency === selectedCurrency);
    if (!stripePlan || !stripePlan.stripePriceId) {
      stripePlan = plan.stripePlans?.find((sp) => sp.currency === plan.basePrice.currency) || plan.stripePlans?.[0];
    }

    if (!stripePlan || !stripePlan.stripePriceId) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: "Stripe plan not available for this artist",
      });
    }

    const exactStripePriceId = stripePlan.stripePriceId;

    // 6️⃣ Create Checkout session
    const session = await createSubscriptionCheckoutSession({
      userId: user._id.toString(),
      artistId,
      cycle,
      transactionId: transaction._id.toString(),
      stripeCustomerId,
      stripePriceId: exactStripePriceId,
      customReturnUrl: returnUrl,
      isTrial,
      trialDays,
    });

    transaction.metadata = {
      checkoutSessionId: session.id,
      isTrial: isTrial ? "true" : "false",
    };
    await transaction.save();

    return res.status(StatusCodes.OK).json({
      checkoutUrl: session.url,
      clientSecret: session.client_secret,
      checkoutSessionId: session.id,
      isTrial,
      trialDays,
    });

  } catch (error) {
    console.error("Subscription Checkout Error:", error);

    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      message: "Unable to create subscription checkout",
    });
  }
};

import { convertCurrencies } from "../../../utils/convertCurrencies.js";
import { cycleToInterval } from "../../../utils/cycleToInterval.js";
import { stripeProvider } from "../../../providers/stripeProvider.js";
import { addStripeMigrationJob } from "../queue/stripeMigration.queue.js";

export const updateStripePricing = async (artistId, subscriptionPrice, cycle) => {
  if (!artistId) throw new Error("No artist profile found");
  if (!subscriptionPrice || !cycle) throw new Error("subscriptionPrice and cycle are required");

  const artist = await Artist.findById(artistId);
  if (!artist || !artist.subscriptionPlans?.length) {
    throw new Error("Artist monetization not set up yet");
  }

  const planIndex = artist.subscriptionPlans.findIndex(p => p.cycle === cycle);
  if (planIndex === -1) {
    throw new Error("Plan for this cycle not found");
  }

  const plan = artist.subscriptionPlans[planIndex];
  if (!plan.stripeProductId) {
    throw new Error("Stripe product ID not found for this plan");
  }

  // 1. Convert currencies
  const basePrice = { currency: "USD", amount: subscriptionPrice };
  const convertedPrices = await convertCurrencies(basePrice.currency, basePrice.amount);
  
  // 2. Generate new Stripe Prices under existing product
  const intervals = cycleToInterval(cycle);
  const newStripePlans = await stripeProvider.createPricesForExistingProduct(
    plan.stripeProductId,
    basePrice,
    convertedPrices,
    intervals.stripe.interval,
    intervals.stripe.interval_count
  );

  // 3. Update the database
  artist.subscriptionPlans[planIndex].basePrice = basePrice;
  artist.subscriptionPlans[planIndex].convertedPrices = convertedPrices;
  artist.subscriptionPlans[planIndex].stripePlans = newStripePlans;
  await artist.save();

  // 4. Trigger background migration
  await addStripeMigrationJob(artistId.toString(), newStripePlans);

  return newStripePlans;
};


