import { verifyRazorpaySignature } from "../razorpay/razorpay.utils.js";
import { handleRazorpayEvent } from "../razorpay/razorpayWebhook.service.js";

export const razorpayWebhook = async (req, res) => {
  try {
    if (!verifyRazorpaySignature(req)) {
      console.error("❌ Invalid Razorpay signature");
      return res.status(400).json({ message: "Invalid signature" });
    }

    const eventData = JSON.parse(req.body.toString());
    const event = eventData.event;

    console.log(`📥 Razorpay event received: ${event}`);

    await handleRazorpayEvent(event, eventData);

    return res.status(200).json({ status: "processed" });

  } catch (err) {
    console.error("❌ Webhook processing failed:", err);
    return res.status(500).json({ message: "Something went wrong" });
  }
};