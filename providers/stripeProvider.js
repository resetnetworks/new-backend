import Stripe from "stripe";
import { formatAmount } from "../modules/payment/utils/formatCurrencies.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const stripeProvider = {
  async createPlans(artistName, basePrice, convertedPrices, interval, interval_count) {
    // 1. Create the single shared Product
    const product = await stripe.products.create({
      name: `${artistName} Subscription`,
      metadata: { artistName },
    });

    // 2. Combine basePrice and convertedPrices into one array
    const allPrices = [basePrice, ...(convertedPrices || [])];

    // 3. Create a Stripe Price for each currency in parallel
    const stripePlans = await Promise.all(
      allPrices.map(async (p) => {
        const price = await stripe.prices.create({
          product: product.id,
          currency: p.currency.toLowerCase(),
          unit_amount: formatAmount(p.amount, p.currency.toLowerCase()),
          recurring: { interval, interval_count },
        });

        return {
          currency: p.currency.toUpperCase(),
          stripePriceId: price.id
        };
      })
    );

    return {
      productId: product.id,
      stripePlans
    };
  }

};