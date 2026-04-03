import { razorpay } from "../../../../config/razorpay.js";
export const createRazorpaySubscriptionAPI = async ({
  planId,
  userId,
  artistId,
  cycle,
}) => {
  return razorpay.subscriptions.create({
    plan_id: planId,
    total_count:
      cycle === "1m"
        ? 12
        : cycle === "3m"
        ? 4
        : cycle === "6m"
        ? 2
        : 12,
    customer_notify: 1,
    notes: {
      userId: userId.toString(),
      artistId: artistId.toString(),
      cycle,
    },
  });
};