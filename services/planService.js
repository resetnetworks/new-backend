import { stripeProvider } from "../providers/stripeProvider.js";
import { razorpayProvider } from "../providers/razorpayProvider.js";
import { paypalProvider } from "../providers/paypalProvider.js";
import { getSubscriptionAmount } from "../utils/getSubscriptionAmount.js";
import { cycleToInterval } from "../utils/cycleToInterval.js";

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
      cycle.stripe.stripe_interval_count || cycle.stripe.interval_count
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
export const updateSubscriptionPlans = async (artist, newPrice, intervals, newCycleLabel, convertedPrices) => {
  const plan = artist.subscriptionPlans[0]; // single cycle

  const cycleIntervals = intervals || cycleToInterval(plan.cycle);
  const targetPrice = newPrice ?? plan.basePrice;
  const targetConversions = convertedPrices || plan.convertedPrices;

  // Calculate Razorpay amount in INR
  const razorpayAmount = getSubscriptionAmount({ price: targetPrice, convertedPrices: targetConversions }, "INR");

  // Update external providers if price or cycle changed
  const [stripePlans, razorpayPlanId, paypalPlans] = await Promise.all([
    (newPrice !== undefined || intervals)
      ? (plan?.stripeProductId
          ? stripeProvider.createPricesForExistingProduct(
              plan.stripeProductId,
              targetPrice,
              targetConversions,
              cycleIntervals.stripe.interval,
              cycleIntervals.stripe.stripe_interval_count || cycleIntervals.stripe.interval_count
            ).then(plans => ({ productId: plan.stripeProductId, stripePlans: plans }))
          : stripeProvider.createPlans(
              artist.name,
              targetPrice,
              targetConversions,
              cycleIntervals.stripe.interval,
              cycleIntervals.stripe.stripe_interval_count || cycleIntervals.stripe.interval_count
            )
        )
      : { productId: plan?.stripeProductId, stripePlans: plan?.stripePlans || [] },
    (newPrice !== undefined || intervals)
      ? razorpayProvider.createPlan(artist.name, razorpayAmount, cycleIntervals.razorpay.interval, cycleIntervals.razorpay.period)
      : plan?.razorpayPlanId,
    (newPrice !== undefined || intervals)
      ? paypalProvider.createPlans(artist.name, targetPrice, targetConversions, cycleIntervals.paypal.interval_unit, cycleIntervals.paypal.interval_count)
      : plan?.paypalPlans
  ]);

  // Update local plan
  plan.cycle = newCycleLabel ?? plan.cycle;
  plan.basePrice = targetPrice;
  plan.convertedPrices = targetConversions;

  if (stripePlans) {
    plan.stripeProductId = stripePlans.productId;
    plan.stripePlans = stripePlans.stripePlans;
  }

  plan.razorpayPlanId = razorpayPlanId;
  plan.paypalPlans = paypalPlans;

  return plan;
};
