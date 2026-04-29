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
    const { artistId, cycle, currency = "USD" } = req.body;
    const user = req.user;

    if (!artistId || !cycle) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: "artistId and cycle are required",
      });
    }

    // 1️⃣ Prevent duplicate active subscription
    const existingSubscription = await Subscription.findOne({
      userId: user._id,
      artistId,
      status: "active",
    });

    if (existingSubscription) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: "You already have an active subscription for this artist",
      });
    }

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

    // ✅ SIMPLIFIED CURRENCY LOGIC
    const selectedCurrency = currency.toUpperCase();

    if (!ALLOWED_CURRENCIES.includes(selectedCurrency)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: "Currency not supported",
      });
    }

    // Find matching price in DB
    const priceEntry =
      selectedCurrency === plan.basePrice.currency
        ? plan.basePrice
        : plan.convertedPrices?.find(
            (p) => p.currency === selectedCurrency
          );

    if (!priceEntry) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: "Price not available in selected currency",
      });
    }

    const amount = priceEntry.amount;
    const normalizedCurrency = selectedCurrency.toLowerCase();

    // 3️⃣ Calculate platform fee
    const isZeroDecimal = ZERO_DECIMAL_CURRENCIES.includes(selectedCurrency);

    let platformFee;
    let artistShare;

    if (isZeroDecimal) {
      platformFee = Math.round(amount * PLATFORM_FEE_PERCENT);
      artistShare = amount - platformFee;
    }
    else {
      platformFee = Number((amount * PLATFORM_FEE_PERCENT).toFixed(2));
      artistShare = Number((amount - platformFee).toFixed(2));
    }

    // 4️⃣ Create pending transaction
    const transaction = await Transaction.create({
      userId: user._id,
      artistId,
      itemId: artistId,  // for subscription, itemId can be artistId or planId based on your design, remove it afterwards
      itemType: "artist-subscription",
      gateway: "stripe",
      amount,
      currency: selectedCurrency,
      status: "pending", // 🔥 IMPORTANT
      platformFee,
      artistShare,
    });
    
   

    // 5️⃣ Get Stripe customer
    const stripeCustomerId = await getOrCreateStripeCustomer(user);

    // 6️⃣ Create Checkout session (subscription mode)
    const session = await createSubscriptionCheckoutSession({
      amount,
      currency: normalizedCurrency,
      userId: user._id.toString(),
      artistId,
      cycle,
      transactionId: transaction._id.toString(),
      stripeCustomerId,
    });

    return res.status(StatusCodes.OK).json({
      checkoutUrl: session.url,
    });

  } catch (error) {
    console.error("Subscription Checkout Error:", error);

    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      message: "Unable to create subscription checkout",
    });
  }
};
