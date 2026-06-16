import { updateStripePricing } from "../../payment/controllers/subscription.controller.js";

export const updateGlobalArtistPricing = async (artistId, subscriptionPrice, cycle) => {
  // 1. Stripe Logic
  const stripePlans = await updateStripePricing(artistId, subscriptionPrice, cycle);

  // 2. PayPal Logic
  // TODO: Call PayPal service to generate plans
  // TODO: Save PayPal plans to DB
  
  // 3. Razorpay Logic
  // TODO: Call Razorpay service to generate plans
  // TODO: Save Razorpay plans to DB

  return {
    stripePlans,
    // paypalPlans,
    // razorpayPlans
  };
};
