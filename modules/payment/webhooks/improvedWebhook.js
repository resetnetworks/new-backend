import { stripe } from "../providers/stripe.client.js";
import { WebhookEventLog } from "../../../models/WebhookEventLog.js";
import { Subscription } from "../../../models/Subscription.js";

import {
  markTransactionPaid,
  updateUserAfterPurchase,
} from "../../../services/paymentService.js";

import { processAndSendInvoice } from "../../../services/invoiceService.js";

export const handleStripeWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // ✅ Idempotency
  const exists = await WebhookEventLog.findOne({ eventId: event.id });
  if (exists) {
    return res.status(200).json({ received: true, duplicate: true });
  }

  await WebhookEventLog.create({
    eventId: event.id,
    type: event.type,
  });

  try {
    switch (event.type) {

      // ===================================================
      // ✅ ONE-TIME PAYMENT SUCCESS
      // ===================================================
      case "payment_intent.succeeded": {
        const data = event.data.object;

        // Skip subscription invoices
        if (data.invoice) break;

        const transaction = await markTransactionPaid({
          gateway: "stripe",
          paymentIntentId: data.id,
        });

        if (transaction) {
          await updateUserAfterPurchase(transaction, data.id);
          await processAndSendInvoice(transaction);
        }

        break;
      }

      // ===================================================
      // ✅ SUBSCRIPTION PAYMENT SUCCESS (first + renewal)
      // ===================================================
      case "invoice.payment_succeeded": {
        const data = event.data.object;
        const subscriptionId = data.subscription;

        if (!subscriptionId) break;

        const transaction = await markTransactionPaid({
          gateway: "stripe",
          stripeSubscriptionId: subscriptionId,
        });

        if (transaction) {
          await updateUserAfterPurchase(transaction, subscriptionId);
          await processAndSendInvoice(transaction);
        }

        break;
      }

      // ===================================================
      // ❌ SUBSCRIPTION PAYMENT FAILED
      // ===================================================
      case "invoice.payment_failed": {
        const data = event.data.object;
        await Subscription.findOneAndUpdate(
          { externalSubscriptionId: data.subscription },
          { status: "failed" }
        );
        break;
      }

      // ===================================================
      // 🚫 SUBSCRIPTION CANCELLED
      // ===================================================
      case "customer.subscription.deleted": {
        const data = event.data.object;

        await Subscription.findOneAndUpdate(
          { externalSubscriptionId: data.id },
          { status: "cancelled" }
        );
        break;
      }

      default:
        console.log("Unhandled Stripe event:", event.type);
    }

    return res.status(200).json({ received: true });

  } catch (err) {
    console.error("Stripe webhook error:", err);
    return res.status(500).json({ error: "Webhook failed" });
  }
};