const buildQuery = (payload) => {
  if (payload.gateway === "razorpay") {
    if (payload.subscriptionId) {
      return {
        "metadata.razorpaySubscriptionId": payload.subscriptionId,
      };
    }

    if (payload.orderId) {
      return { razorpayOrderId: payload.orderId };
    }

    return { paymentId: payload.paymentId };
  }

  throw new Error("Unsupported gateway");
};

export default buildQuery 