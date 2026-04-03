import { processPayment } from "../common/payment.service.js";
import { normalizeRazorpayPayment } from "./razorpay.normalizer.js";
import {
  updateSubscriptionStatus,
  mapRazorpaySubscriptionStatus,
} from "../subscription/subscription.service.js";
import  logger  from "../../../utils/logger.js";
import { razorpay } from "../../../config/razorpay.js";



// --------------------------------------------------
// 🔹 Main Event Router
// --------------------------------------------------
export const handleRazorpayEvent = async (event, eventData) => {
  const eventId =
    eventData?.payload?.payment?.entity?.id ||
    eventData?.payload?.subscription?.entity?.id ||
    null;

  try {
    // ---------------------------
    // 1️⃣ Route events
    // ---------------------------
    switch (event) {
      case "payment.captured":
        return await handlePaymentCaptured(eventData);

      case "subscription.activated":
      case "subscription.charged":
      case "subscription.cancelled":
      case "subscription.halted":
      case "subscription.completed":
      case "subscription.authenticated":
        return await handleSubscriptionEvent(eventData);

      default:
        logger.warn(
          { event, eventId },
          "Ignored unknown Razorpay event"
        );
    }
  } catch (err) {
    // ---------------------------
    // 2️⃣ Local error logging
    // ---------------------------
    logger.error(
      {
        event,
        eventId,
        error: err.message,
        stack: err.stack,
      },
      "Error handling Razorpay event"
    );

    throw err; // let controller handle response
  }
};

// --------------------------------------------------
// 🔹 Payment Captured Handler
// --------------------------------------------------
export const handlePaymentCaptured = async (eventData) => {
  const paymentEntity = eventData.payload.payment.entity;
  const paymentId = paymentEntity.id;

  logger.info({ paymentId }, "Processing Razorpay payment");

  let fullPayment = paymentEntity; // 🔥 use webhook data first
  let subscriptionId = null;

  try {
    // ---------------------------
    // 1️⃣ Fetch full payment only if needed
    // ---------------------------
    if (!paymentEntity.notes || !paymentEntity.amount) {
      fullPayment = await razorpay.payments.fetch(paymentId);
    }

    // ---------------------------
    // 2️⃣ Detect subscription payment
    // ---------------------------
    if (fullPayment.invoice_id) {
      try {
        const invoice = await razorpay.invoices.fetch(
          fullPayment.invoice_id
        );
        subscriptionId = invoice.subscription_id;
      } catch (err) {
        logger.error(
          { paymentId, error: err.message },
          "Failed to fetch invoice for subscription detection"
        );
      }
    }

    // ---------------------------
    // 3️⃣ Normalize payload
    // ---------------------------
    const { isValid, payload, error, rawMetadata } =
      await normalizeRazorpayPayment({
        fullPayment,
        paymentEntity,
        subscriptionId,
      });

    if (!isValid) {
      logger.error(
        {
          paymentId,
          error,
          rawMetadata,
        },
        "Invalid normalized payload"
      );
      return;
    }

    // ---------------------------
    // 4️⃣ Core engine
    // ---------------------------
    return await processPayment(payload);

  } catch (err) {
    logger.error(
      {
        paymentId,
        error: err.message,
        stack: err.stack,
      },
      "Failed to handle payment.captured"
    );

    throw err;
  }
};

// --------------------------------------------------
// 🔹 Subscription Events Handler
// --------------------------------------------------
export const handleSubscriptionEvent = async (eventData) => {
  const subId = eventData.payload.subscription.entity.id;
  const event = eventData.event;

  try {
    // ---------------------------
    // 1️⃣ Fetch latest subscription state
    // ---------------------------
    const subEntity = await razorpay.subscriptions.fetch(subId);

    const rawStatus = subEntity.status;
    const mappedStatus = mapRazorpaySubscriptionStatus(rawStatus);

    // ---------------------------
    // 2️⃣ Handle unknown status
    // ---------------------------
    if (mappedStatus === "unknown") {
      logger.warn(
        { subId, rawStatus, event },
        "Unknown subscription status"
      );
      return;
    }

    // ---------------------------
    // 3️⃣ Update DB (idempotent inside service)
    // ---------------------------
    const updated = await updateSubscriptionStatus({
      externalSubscriptionId: subId,
      status: mappedStatus,
    });

    if (!updated) {
      logger.warn(
        { subId, mappedStatus },
        "Subscription not found"
      );
    } else {
      logger.info(
        { subId, mappedStatus },
        "Subscription status updated"
      );
    }

  } catch (err) {
    // ---------------------------
    // 4️⃣ Error handling
    // ---------------------------
    logger.error(
      {
        subId,
        event,
        error: err.message,
        stack: err.stack,
      },
      "Failed to handle subscription event"
    );

    throw err;
  }
};