import { stripeProvider } from "../providers/stripeProvider.js";
import { razorpayProvider } from "../providers/razorpayProvider.js";
import { paypalProvider } from "../providers/paypalProvider.js";
import { getSubscriptionAmount } from "../utils/getSubscriptionAmount.js";

export const createSubscriptionPlans = async (artistName, basePrice, cycle, convertedPrices) => {
  const { razorpay, paypal } = cycle;
  const INRAmount = getSubscriptionAmount({ price: basePrice, convertedPrices }, "INR");
  // Parallel API calls
  const [razorpayPlanId, paypalPlans, stripePlan] = await Promise.all([
    razorpayProvider.createPlan(artistName, INRAmount, razorpay.interval, razorpay.period, basePrice.currency),
    paypalProvider.createPlans(artistName, basePrice, convertedPrices, paypal.interval_unit, paypal.interval_count),

    stripeProvider.createPlans(
      artistName,
      basePrice,
      convertedPrices,
      cycle.stripe.interval,
      cycle.stripe.interval_count
    )
  ]);

  // return { stripePriceId: null, razorpayPlanId, paypalPlans };
  return {
    stripeProductId: stripePlan.productId,
    stripePlans: stripePlan.stripePlans,
    razorpayPlanId,
    paypalPlans
  };
};


/**
 * Update subscription plans across Stripe/Razorpay/PayPal
 */
export const updateSubscriptionPlans = async (artist, newPrice, intervals, newCycleLabel) => {
  const plan = artist.subscriptionPlans[0]; // single cycle

  const cycleIntervals = intervals || {
    stripe: { interval: plan.stripeInterval, interval_count: plan.stripeIntervalCount },
    razorpay: { interval: plan.razorpayInterval, period: plan.razorpayPeriod },
    paypal: { interval_unit: plan.paypalIntervalUnit, interval_count: plan.paypalIntervalCount },
  };

  // Update external providers if price or cycle changed
  const [stripePlan, razorpayPlanId, paypalPlans] = await Promise.all([
    (newPrice !== undefined || intervals)
      ? stripeProvider.createPlan(
        artist.name,
        newPrice ?? plan.basePrice,
        cycleIntervals.stripe.interval,
        cycleIntervals.stripe.interval_count
      )
      : null,
    (newPrice !== undefined || intervals)
      ? razorpayProvider.createPlan(artist.name, newPrice ?? plan.price, cycleIntervals.razorpay.interval, cycleIntervals.razorpay.period)
      : plan.razorpayPlanId,
    (newPrice !== undefined || intervals)
      ? paypalProvider.createPlans(artist.name, newPrice ?? plan.price, cycleIntervals.paypal.interval_unit, cycleIntervals.paypal.interval_count)
      : plan.paypalPlans
  ]);

  // Update local plan
  // plan.cycle = newCycleLabel;
  // plan.price = newPrice ?? plan.price;
  // plan.stripePriceId = stripePriceId;
  // plan.razorpayPlanId = razorpayPlanId;
  // plan.paypalPlans = paypalPlans;

  // Update local plan
  plan.cycle = newCycleLabel ?? plan.cycle;
  plan.price = newPrice ?? plan.price;

  if (stripePlan) {
    plan.stripeProductId = stripePlan.productId;
    plan.stripePriceId = stripePlan.priceId;
  }

  plan.razorpayPlanId = razorpayPlanId;
  plan.paypalPlans = paypalPlans;

  return plan;
};
