import crypto from "crypto";
import { Transaction } from "../../../models/Transaction.js";
import { Subscription } from "../../../models/Subscription.js";
import {markTransactionPaid, updateUserAfterPurchase,} from "../../../services/paymentService.js";
import { WebhookEventLog } from "../../../models/WebhookEventLog.js";
import Razorpay from "razorpay";
import {processAndSendInvoice} from "../../../services/invoiceService.js";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});


export const handleRazorpayEvent = async (event, eventData) => {
  if (event === "payment.captured") {
    return handlePaymentCaptured(eventData);
  }

  const subscriptionEvents = [
    "subscription.activated",
    "subscription.charged",
    "subscription.cancelled",
    "subscription.halted",
    "subscription.completed",
    "subscription.authenticated",
  ];

  if (subscriptionEvents.includes(event)) {
    return handleSubscriptionEvent(eventData);
  }

  console.log("⚠️ Ignored unknown event:", event);
};


const handlePaymentCaptured = async (eventData) => {
  const paymentEntity = eventData.payload.payment.entity;
  const paymentId = paymentEntity.id;
  const razorpayOrderId = paymentEntity.order_id;

  console.log("[Razorpay] Processing payment:", paymentId);

  const fullPayment = await razorpay.payments.fetch(paymentId);

  let subscriptionId = null;

  if (fullPayment.invoice_id) {
    const invoice = await razorpay.invoices.fetch(fullPayment.invoice_id);
    subscriptionId = invoice.subscription_id;
  }

  // 🔥 NORMALIZED PAYLOAD
  const basePayload = {
    gateway: "razorpay",
    paymentId,
    orderId: razorpayOrderId,
    metadata: fullPayment.notes || {},
  };

  if (subscriptionId) {
    return handleSubscriptionPayment({
      ...basePayload,
      subscriptionId,
      type: "subscription",
    });
  }

  return handleOneTimePayment({
    ...basePayload,
    type: "one-time",
  });
};

const handleSubscriptionEvent = async (eventData) => {
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
};

const handleSubscriptionPayment = async ({
  paymentId,
  subscriptionId,
  razorpayOrderId,
}) => {
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
};

const handleOneTimePayment = async ({
  paymentId,
  razorpayOrderId,
  notes,
}) => {
  const { itemType: type, itemId, userId } = notes || {};

  if (!type || !itemId || !userId) {
    console.warn("⚠️ Missing metadata for one-time payment.");
    return;
  }

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
};