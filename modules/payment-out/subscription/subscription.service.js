import {Subscription} from "../../../models/Subscription.js";
import  logger  from "../../../utils/logger.js";

export const updateSubscriptionStatus = async ({
  externalSubscriptionId,
  status,
}) => {
  const updated = await Subscription.findOneAndUpdate(
    {
      externalSubscriptionId,
      status: { $ne: status }, // 🔥 atomic idempotency
    },
    {
      $set: { status },
    },
    { new: true }
  );

  if (!updated) {
    // Could be:
    // 1. subscription not found
    // 2. already same status

    const exists = await Subscription.exists({
      externalSubscriptionId,
    });

    if (!exists) {
      logger.warn(
        { externalSubscriptionId },
        "Subscription not found"
      );
      return false;
    }

    logger.info(
      { externalSubscriptionId, status },
      "Subscription already in desired state"
    );

    return true;
  }

  logger.info(
    { externalSubscriptionId, status },
    "Subscription status updated"
  );

  return true;
};


export const mapRazorpaySubscriptionStatus = (razorpayStatus) => {
  switch (razorpayStatus) {
    case "active":
      return "active";

    case "completed":
      return "expired"; // 🔥 fix

    case "cancelled":
    case "halted":
      return "cancelled";

    default:
      return "unknown";
  }
};