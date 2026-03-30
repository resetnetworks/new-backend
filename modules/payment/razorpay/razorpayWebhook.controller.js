import { verifyRazorpaySignature } from "../razorpay/razorpay.utils.js";
import { handleRazorpayEvent } from "../razorpay/razorpayWebhook.service.js";
import  logger  from "../../../utils/logger.js";


export const razorpayWebhook = async (req, res) => {
  try {
    // ---------------------------
    // 1️⃣ Verify signature (CRITICAL)
    // ---------------------------
    if (!verifyRazorpaySignature(req)) {
      logger.error(
        { gateway: "razorpay" },
        "Invalid Razorpay signature"
      );
      return res.status(400).json({ message: "Invalid signature" });
    }

    // ---------------------------
    // 2️⃣ Parse raw body safely
    // ---------------------------
    let eventData;

    try {
      eventData = JSON.parse(req.body.toString());
    } catch (err) {
      logger.error(
        { error: err.message, gateway: "razorpay" },
        "Failed to parse webhook body"
      );
      return res.status(400).json({ message: "Invalid payload" });
    }

    const event = eventData?.event;

    if (!event) {
      logger.error(
        { eventData, gateway: "razorpay" },
        "Missing event in webhook"
      );
      return res.status(400).json({ message: "Invalid event" });
    }

    // ---------------------------
    // 3️⃣ Extract eventId (debugging + idempotency support)
    // ---------------------------
    const eventId =
      eventData?.payload?.payment?.entity?.id ||
      eventData?.payload?.subscription?.entity?.id ||
      null;

    // ---------------------------
    // 4️⃣ Log webhook receipt
    // ---------------------------
    logger.info(
      {
        event,
        eventId,
        gateway: "razorpay",
      },
      "Webhook received"
    );

    // ---------------------------
    // 5️⃣ Delegate processing
    // ---------------------------
    await handleRazorpayEvent(event, eventData);

    // ---------------------------
    // 6️⃣ Always return 200 (prevent retries)
    // ---------------------------
    return res.status(200).json({ status: "processed" });

  } catch (err) {
    // ---------------------------
    // 7️⃣ Catch-all (DO NOT trigger retries)
    // ---------------------------
    logger.error(
      {
        error: err.message,
        stack: err.stack,
        gateway: "razorpay",
      },
      "Webhook processing failed"
    );

    return res.status(200).json({ status: "error logged" });
  }
};