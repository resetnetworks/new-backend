import { validatePaymentMetadata } from "../common/payment.validator.js";

const getField = (...values) =>
  values.find((v) => v !== undefined && v !== null);

export const normalizeRazorpayPayment = ({
  fullPayment,
  paymentEntity,
  subscriptionId,
}) => {
  const paymentId = paymentEntity.id;
  const orderId = paymentEntity.order_id;

  const rawMetadata = fullPayment.notes || {};

  // ----------------------------
  // 🔥 Normalize metadata
  // ----------------------------
  const normalizedMetadata = {
    userId: getField(rawMetadata.userId, rawMetadata.user_id),
    itemId: getField(
      rawMetadata.itemId,
      rawMetadata.item_id,
      rawMetadata.artist_id
    ),
    itemType: getField(
      rawMetadata.itemType,
      rawMetadata.item_type,
      subscriptionId ? "artist-subscription" : null
    ),
    couponId: getField(
      rawMetadata.couponId,
      rawMetadata.coupon_id,
      null
    ),
  };

  // ----------------------------
  // 🔥 Subscription safety check
  // ----------------------------
  if (subscriptionId && !normalizedMetadata.itemId) {
    return {
      isValid: false,
      error: "Missing artistId for subscription",
      rawMetadata,
    };
  }

  // ----------------------------
  // 🔥 Validate metadata
  // ----------------------------
  const { isValid, data, error } =
    validatePaymentMetadata(normalizedMetadata);

  if (!isValid) {
    return {
      isValid: false,
      error,
      rawMetadata,
    };
  }

  const { userId, itemId, itemType, couponId } = data;

  // ----------------------------
  // 🔥 Final payload
  // ----------------------------
  return {
    isValid: true,
    payload: {
      gateway: "razorpay",
      paymentId,
      orderId,
      type: subscriptionId ? "subscription" : "one-time",
      userId,
      itemId,
      itemType,
      subscriptionId: subscriptionId || null,
      couponId,

      // 🔥 future validation fields
      amount: fullPayment.amount,
      currency: fullPayment.currency,
    },
  };
};