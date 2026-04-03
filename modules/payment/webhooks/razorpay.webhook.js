import { WebhookEvent } from "../domain/webhookEvent.model.js";
import logger from "../../../utils/logger.js";

export const handleRazorpayEvent = async (event, eventData) => {
  const eventId = getEventId(eventData);

  if (!eventId) {
    logger.warn({ event }, "Missing eventId");
    return "IGNORED";
  }

  // ----------------------------
  // 🔴 Idempotency check
  // ----------------------------
  const existing = await WebhookEvent.findOne({ eventId });

  if (existing) {
    logger.info({ eventId }, "Duplicate webhook event");
    return "IGNORED";
  }

  try {
    // ----------------------------
    // 🔥 Process event
    // ----------------------------
    switch (event) {
      case "payment.captured":
        await handlePaymentCaptured(eventData);
        break;

      case "subscription.activated":
      case "subscription.charged":
      case "subscription.cancelled":
      case "subscription.halted":
      case "subscription.completed":
      case "subscription.authenticated":
        await handleSubscriptionEvent(eventData);
        break;

      default:
        return "IGNORED";
    }

    // ----------------------------
    // ✅ Mark event as processed
    // ----------------------------
    await WebhookEvent.create({
      eventId,
      provider: "razorpay",
    });

    return "SUCCESS";

  } catch (err) {
    logger.error({ err, eventId }, "Webhook processing failed");
    throw err; // 🔴 ensures retry
  }
};