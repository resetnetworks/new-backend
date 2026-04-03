import { verifyRazorpaySignature } from "../gateways/razorpay.gateway.js";
import { handleRazorpayEvent } from "../webhooks/razorpay.webhook.js";
import logger from "../../../utils/logger.js";

export const razorpayWebhook = async (req, res) => {
  try {
    // ---------------------------
    // 1️⃣ Verify signature
    // ---------------------------
    if (!verifyRazorpaySignature(req)) {
      logger.error({ gateway: "razorpay" }, "Invalid signature");
      return res.status(400).json({ message: "Invalid signature" });
    }

    // ---------------------------
    // 2️⃣ Parse body
    // ---------------------------
    let eventData;

    try {
      eventData = JSON.parse(req.body.toString());
    } catch (err) {
      logger.error({ err }, "Invalid webhook payload");
      return res.status(400).json({ message: "Invalid payload" });
    }

    const event = eventData?.event;

    if (!event) {
      logger.error({ eventData }, "Missing event");
      return res.status(400).json({ message: "Invalid event" });
    }

    // ---------------------------
    // 3️⃣ Process event
    // ---------------------------
    const result = await handleRazorpayEvent(event, eventData);

    // ---------------------------
    // 4️⃣ Decide response
    // ---------------------------
    if (result === "SUCCESS" || result === "IGNORED") {
      return res.status(200).json({ status: result });
    }

    // fallback (should not happen)
    logger.error({ event }, "Unknown processing result");
    return res.status(500).json({ message: "Retry webhook" });

  } catch (err) {
    logger.error(
      {
        err,
        stack: err.stack,
        gateway: "razorpay",
      },
      "Webhook processing failed"
    );

    // 🔴 IMPORTANT: trigger retry
    return res.status(500).json({ message: "Retry webhook" });
  }
};