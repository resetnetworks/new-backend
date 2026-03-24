export const handleRazorpayEvent = async (event, eventData) => {
  // ---------------------------
  // Payment Captured
  // ---------------------------
  if (event === "payment.captured") {
    const paymentEntity = eventData.payload.payment.entity;
    const paymentId = paymentEntity.id;
    const razorpayOrderId = paymentEntity.order_id;

    const fullPayment = await razorpay.payments.fetch(paymentId);
    let subscriptionId = null;

    if (fullPayment.invoice_id) {
      const invoice = await razorpay.invoices.fetch(fullPayment.invoice_id);
      subscriptionId = invoice.subscription_id;
    }

    if (subscriptionId) {
      const transaction = await markTransactionPaid({
        gateway: "razorpay",
        paymentId,
        subscriptionId,
        razorpayOrderId,
      });

      if (transaction) {
        await updateUserAfterPurchase(transaction, subscriptionId);
        console.log("✅ Subscription payment processed:", subscriptionId);
      }

      await processAndSendInvoice(transaction);
      console.log("📧 Invoice emailed to user for subscription:", subscriptionId);

      return;
    }

    // One-time payment
    const { itemType: type, itemId, userId } = fullPayment.notes || {};

    if (type && itemId && userId) {
      const transaction = await markTransactionPaid({
        gateway: "razorpay",
        paymentId,
        userId,
        itemId,
        type,
        razorpayOrderId,
      });

      if (transaction) {
        await updateUserAfterPurchase(transaction, paymentId);
        console.log("✅ One-time purchase completed:", type, itemId);

        await processAndSendInvoice(transaction);
        console.log(
          "📧 Invoice emailed to user for one-time purchase:",
          type,
          itemId
        );
      }
    } else {
      console.warn("⚠️ Missing metadata for one-time payment.");
    }

    return;
  }

  // ---------------------------
  // Subscription events
  // ---------------------------
  const subscriptionEvents = [
    "subscription.activated",
    "subscription.charged",
    "subscription.cancelled",
    "subscription.halted",
    "subscription.completed",
    "subscription.authenticated",
  ];

  if (subscriptionEvents.includes(event)) {
    const subId = eventData.payload.subscription.entity.id;

    const subEntity = await razorpay.subscriptions.fetch(subId);
    const status = subEntity.status;

    switch (status) {
      case "active":
        await Subscription.findOneAndUpdate(
          { externalSubscriptionId: subId },
          { status: "active" }
        );
        console.log("✅ Subscription active:", subId);
        break;

      case "completed":
        await Subscription.findOneAndUpdate(
          { externalSubscriptionId: subId },
          { status: "completed" }
        );
        console.log("✅ Subscription lifecycle completed:", subId);
        break;

      case "cancelled":
      case "halted":
        await Subscription.findOneAndUpdate(
          { externalSubscriptionId: subId },
          { status: "cancelled" }
        );
        console.log("❌ Subscription cancelled/halted:", subId);
        break;

      default:
        console.log(
          "ℹ️ Subscription event ignored:",
          subId,
          "status:",
          status
        );
    }

    return;
  }

  // ---------------------------
  // Unknown event
  // ---------------------------
  console.log("⚠️ Ignored unknown event:", event);
};