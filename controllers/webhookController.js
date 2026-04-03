import Stripe from "stripe";
import crypto from "crypto";
import { Transaction } from "../models/Transaction.js";
import { Subscription } from "../models/Subscription.js";
import {markTransactionPaid, updateUserAfterPurchase,} from "../services/paymentService.js";
import { WebhookEventLog } from "../models/WebhookEventLog.js";
import Razorpay from "razorpay";
import fetch from "node-fetch";
import {processAndSendInvoice} from "../services/invoiceService.js";


const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});


const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const stripeWebhook = async (req, res) => {
  console.log("📡 Stripe webhook called");

  const signature = req.headers["stripe-signature"];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, endpointSecret);
  } catch (err) {
    console.error("❌ Stripe signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const eventType = event.type;
  const data = event.data.object;

  // 🧠 Check if this event has already been processed
const existingLog = await WebhookEventLog.findOne({ eventId: event.id });
if (existingLog) {
  console.warn(`⚠️ Duplicate event ${event.id} ignored`);
  return res.status(200).json({ received: true, duplicate: true });
}

// ✅ First time we're seeing this event → save it
await WebhookEventLog.create({
  eventId: event.id,
  type: event.type,
});


  console.log(`📥 Stripe event received: ${eventType}`);

  try {
    switch (eventType) {
      // ✅ One-time payments: songs or albums
      case "payment_intent.succeeded": {
        const metadata = data.metadata || {};
        const transactionId = metadata.transactionId;

        // 🛑 Skip if this is a subscription invoice
        if (data.invoice) {
          console.log("ℹ️ Skipping payment_intent for subscription invoice:", data.id);
          break;
        }

        if (!transactionId) {
          console.warn("⚠️ Missing transactionId in metadata. Skipping.");
          break;
        }

        const transaction = await markTransactionPaid({
          gateway: "stripe",
          paymentIntentId: data.id,
        });

        if (transaction) {
          await updateUserAfterPurchase(transaction, data.id);
          console.log("✅ One-time payment processed:", data.id);
        } else {
          console.warn("⚠️ Transaction not found or already processed:", transactionId);
        }
        break;
      }

      // ✅ Subscription payment succeeded
      case "invoice.payment_succeeded": {
        const subscriptionId = data.subscription;
        const transaction = await markTransactionPaid({
          gateway: "stripe",
          stripeSubscriptionId: subscriptionId,
        });

        if (transaction) {
          await updateUserAfterPurchase(transaction, subscriptionId);
          console.log("✅ Subscription payment succeeded:", subscriptionId);
        } else {
          console.warn("⚠️ No matching transaction for subscription invoice:", subscriptionId);
        }
        break;
      }

      // ❌ Subscription payment failed
      case "invoice.payment_failed": {
        const subscriptionId = data.subscription;
        await Subscription.findOneAndUpdate(
          { externalSubscriptionId: subscriptionId },
          { status: "failed" }
        );
        console.warn("❌ Subscription payment failed:", subscriptionId);
        break;
      }

      // 🚫 Subscription cancelled (manually or due to end of billing)
      case "customer.subscription.deleted": {
        const subscriptionId = data.id;
        await Subscription.findOneAndUpdate(
          { externalSubscriptionId: subscriptionId },
          { status: "cancelled" }
        );
        console.warn("❌ Subscription cancelled by user or Stripe:", subscriptionId);
        break;
      }

      // ❌ One-time payment failed
      case "payment_intent.payment_failed": {
        const paymentIntentId = data.id;

        console.warn("❌ Stripe: Payment failed for PaymentIntent ID:", paymentIntentId);

        const updated = await Transaction.findOneAndUpdate(
          { paymentIntentId },
          { status: "failed" },
          { new: true }
        );

        if (updated) {
          console.log("🟥 Transaction marked as failed:", updated._id);
        } else {
          console.warn("⚠️ Failed transaction not found in DB:", paymentIntentId);
        }
        break;
      }

      default:
        console.log("ℹ️ Unhandled Stripe event:", eventType);
    }
  } catch (err) {
    console.error("❌ Error processing Stripe webhook:", err.message);
  }

  // ✅ Always respond 200 so Stripe doesn’t retry
  res.status(200).json({ received: true });
};



// export const razorpayWebhook = async (req, res) => {
//   try {
//     const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
//     const signature = req.headers["x-razorpay-signature"];
//     const rawBody = req.body; // express.raw()

//     // ---------------------------
//     // 1️⃣ Verify signature
//     // ---------------------------
//     const expectedSignature = crypto
//       .createHmac("sha256", secret)
//       .update(rawBody)
//       .digest("hex");

//     if (signature !== expectedSignature) {
//       console.error("❌ Invalid Razorpay signature");
//       return res.status(400).json({ message: "Invalid signature" });
//     }

//     const eventData = JSON.parse(rawBody.toString());
//     const event = eventData.event;
//     console.log(`📥 Razorpay event received: ${event}`);

//     // ---------------------------
//     // 2️⃣ Payment Captured (One-time or subscription)
//     // ---------------------------
//     if (event === "payment.captured") {
//       const paymentEntity = eventData.payload.payment.entity;
//       const paymentId = paymentEntity.id;
//       const razorpayOrderId = paymentEntity.order_id;

//       const fullPayment = await razorpay.payments.fetch(paymentId);
//       let subscriptionId = null;

//       if (fullPayment.invoice_id) {
//         const invoice = await razorpay.invoices.fetch(fullPayment.invoice_id);
//         subscriptionId = invoice.subscription_id;
//       }

//       if (subscriptionId) {
//         // Subscription payment
//         const transaction = await markTransactionPaid({
//           gateway: "razorpay",
//           paymentId,
//           subscriptionId,
//           razorpayOrderId,
//         });

//         if (transaction) {
//           await updateUserAfterPurchase(transaction, subscriptionId);
//           console.log("✅ Subscription payment processed:", subscriptionId);
//         }
//         await processAndSendInvoice(transaction);
//         console.log("📧 Invoice emailed to user for subscription:", subscriptionId);

//         return res.status(200).json({ status: "subscription payment processed" });
//       }

//       // One-time payment
//       const { itemType: type, itemId, userId } = fullPayment.notes || {};
//       if (type && itemId && userId) {
//         const transaction = await markTransactionPaid({
//           gateway: "razorpay",
//           paymentId,
//           userId,
//           itemId,
//           type,
//           razorpayOrderId,
//         });

//         if (transaction) {
//           await updateUserAfterPurchase(transaction, paymentId);
//           console.log("✅ One-time purchase completed:", type, itemId);
//           await processAndSendInvoice(transaction);
//           console.log("📧 Invoice emailed to user for one-time purchase:", type, itemId);
//         }
//       } else {
//         console.warn("⚠️ Missing metadata for one-time payment.");
//       }

//       return res.status(200).json({ status: "payment processed" });
//     }

//     // ---------------------------
//     // 3️⃣ Subscription events
//     // ---------------------------
//     const subscriptionEvents = [
//       "subscription.activated",
//       "subscription.charged",
//       "subscription.cancelled",
//       "subscription.halted",
//       "subscription.completed",
//       "subscription.authenticated",
//     ];

//     if (subscriptionEvents.includes(event)) {
//       const subId = eventData.payload.subscription.entity.id;

//       // Fetch latest subscription from Razorpay to get ground-truth status
//       const subEntity = await razorpay.subscriptions.fetch(subId);
//       const status = subEntity.status; // "active", "completed", "cancelled", "halted", etc.

//       switch (status) {
//         case "active":
//           await Subscription.findOneAndUpdate(
//             { externalSubscriptionId: subId },
//             { status: "active" }
//           );
//           console.log("✅ Subscription active:", subId);
//           break;

//         case "completed":
//           await Subscription.findOneAndUpdate(
//             { externalSubscriptionId: subId },
//             { status: "completed" }
//           );
//           console.log("✅ Subscription lifecycle completed:", subId);
//           break;

//         case "cancelled":
//         case "halted":
//           await Subscription.findOneAndUpdate(
//             { externalSubscriptionId: subId },
//             { status: "cancelled" }
//           );
//           console.log("❌ Subscription cancelled/halted:", subId);
//           break;

//         default:
//           console.log("ℹ️ Subscription event ignored:", subId, "status:", status);
//       }

//       return res.status(200).json({ status: "subscription event processed" });
//     }

//     // ---------------------------
//     // 4️⃣ Ignore unknown events
//     // ---------------------------
//     console.log("⚠️ Ignored unknown event:", event);
//     return res.status(200).json({ status: "ignored" });

//   } catch (err) {
//     console.error("❌ Webhook processing failed:", err);
//     return res.status(500).json({ message: "Something went wrong" });
//   }
// };

export const razorpayWebhook = async (req, res) => {
  try {
    const rawBody = req.body;
    const signature = req.headers["x-razorpay-signature"];

    verifyRazorpaySignature(rawBody, signature);

    const eventData = JSON.parse(rawBody.toString());

    await handleRazorpayEvent(eventData);

    return res.status(200).json({ status: "ok" });

  } catch (err) {
    console.error("❌ Webhook failed:", err);
    return res.status(500).json({ message: "Something went wrong" });
  }
};


export const verifyRazorpaySignature = (rawBody, signature) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!signature) {
    throw new Error("Missing Razorpay signature");
  }

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  const isValid = crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );

  if (!isValid) {
    throw new Error("Invalid Razorpay signature");
  }

  return true;
};

export const handleRazorpayEvent = async (eventData) => {
  const event = eventData.event;

  switch (event) {
    case "payment.captured":
      return handlePaymentCaptured(eventData);

    case "subscription.activated":
    case "subscription.charged":
    case "subscription.cancelled":
    case "subscription.halted":
    case "subscription.completed":
      return handleSubscriptionEvent(eventData);

    default:
      console.log("⚠️ Ignored event:", event);
  }
};


export const handlePaymentCaptured = async (eventData) => {
  const paymentEntity = eventData.payload.payment.entity;
  const paymentId = paymentEntity.id;

  const fullPayment = await razorpay.payments.fetch(paymentId);

  // 🔥 IMPORTANT CHANGE
  const { type } = fullPayment.notes || {};

  if (type === "purchase") {
    return handlePurchasePayment(fullPayment);
  }

  if (type === "subscription") {
    return handleSubscriptionPayment(fullPayment);
  }

  console.warn("Unknown payment type");
};

export const handlePurchasePayment = async (payment) => {
  const { itemType, itemId, userId } = payment.notes;

  if (!itemType || !itemId || !userId) {
    throw new Error("Invalid payment metadata");
  }

  const transaction = await markTransactionPaid({
    gateway: "razorpay",
    paymentId: payment.id,
    userId,
    itemId,
    type: itemType,
    razorpayOrderId: payment.order_id,
  });

  if (!transaction) return;

  // 🔥 DO NOT BLOCK WEBHOOK
  processPurchaseSideEffects(transaction);

  console.log("✅ Purchase processed:", itemType, itemId);
};


const processPurchaseSideEffects = async (transaction) => {
  try {
    await Promise.all([
      updateUserAfterPurchase(transaction),
      processAndSendInvoice(transaction),
      creditArtistEarnings(transaction),
    ]);
  } catch (err) {
    console.error("Side effects failed:", err);
  }
};

export const paypalWebhook = async (req, res) => {
  console.log("satellite_antenna: PayPal webhook called");
  try {
    const rawBody = req.body.toString();
    const webhookEvent = JSON.parse(rawBody);
    // :key: Step 1: Verify PayPal signature
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;
    const verificationBody = {
      auth_algo: req.headers["paypal-auth-algo"],
      cert_url: req.headers["paypal-cert-url"],
      transmission_id: req.headers["paypal-transmission-id"],
      transmission_sig: req.headers["paypal-transmission-sig"],
      transmission_time: req.headers["paypal-transmission-time"],
      webhook_id: webhookId,
      webhook_event: webhookEvent,
    };
    // const baseUrl = process.env.PAYPAL_MODE === "live"
    //   ? "https://api-m.paypal.com"
    //   : "https://api-m.sandbox.paypal.com";
    const baseUrl = "https://api-m.paypal.com"
      console.log("baseUrl-----", baseUrl);
    const auth = Buffer.from(
      `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
    ).toString("base64");
    const tokenRes = await fetch(`${baseUrl}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    const { access_token } = await tokenRes.json();
    const verifyRes = await fetch(`${baseUrl}/v1/notifications/verify-webhook-signature`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(verificationBody),
    });
    const verification = await verifyRes.json();
    if (verification.verification_status !== "SUCCESS") {
      console.error(":x: Invalid PayPal signature");
      return res.status(400).json({ message: "Invalid signature" });
    }
    // :white_tick: Step 2: Process event
    const eventType = webhookEvent.event_type;
    console.log(`inbox_tray: PayPal event received: ${eventType}`);
    // :repeat: Subscription flow
    if (eventType === "BILLING.SUBSCRIPTION.ACTIVATED" || eventType === "BILLING.SUBSCRIPTION.RENEWED") {
      const subscriptionId = webhookEvent.resource.id;
      const transaction = await markTransactionPaid({
        gateway: "paypal",
        subscriptionId,
      });
      if (transaction) {
        await updateUserAfterPurchase(transaction, subscriptionId);
        await processAndSendInvoice(transaction);
        console.log(":white_tick: PayPal subscription activated/renewed");
      }
      return res.status(200).json({ status: "subscription processed" });
    }
    // :credit_card: One-time payment flow
    if (eventType === "CHECKOUT.ORDER.APPROVED") {
    console.log("Order approved — awaiting capture");
    // Optionally, you could auto-capture here using the PayPal API.
     return res.status(200).send("Order approved, not yet captured");
   }
    if (eventType === "PAYMENT.CAPTURE.COMPLETED") {
      const { id: paymentId, purchase_units } = webhookEvent.resource;
      // We embed metadata in custom_id
      const notes = purchase_units?.[0]?.custom_id
        ? JSON.parse(purchase_units[0].custom_id)
        : {};
      const { type, itemId, userId } = notes;
      if (!type || !itemId || !userId) {
        console.warn(":warning: Missing metadata for one-time PayPal payment.");
        return res.status(200).send("OK");
      }
      const transaction = await markTransactionPaid({
        gateway: "paypal",
        paymentId,
        userId,
        itemId,
        type,
      });
      if (transaction) {
        await updateUserAfterPurchase(transaction, paymentId);
        await processAndSendInvoice(transaction);
        console.log("white_tick: One-time PayPal purchase completed:", type, itemId);
      }
      return res.status(200).json({ status: "purchase processed" });
    }
     // :small_blue_diamond: Step 3: Invoice service
    // :x: Subscription ended/cancelled
    if (eventType === "BILLING.SUBSCRIPTION.CANCELLED" || eventType === "BILLING.SUBSCRIPTION.EXPIRED") {
      await Subscription.findOneAndUpdate(
        { externalSubscriptionId: webhookEvent.resource.id },
        { status: "cancelled" }
      );
      console.log(":x: PayPal subscription cancelled/expired.");
      return res.status(200).json({ status: "ok" });
    }
    // :arrows_anticlockwise: Default → just log
    console.log(":information_source: Ignored PayPal event:", eventType);
    return res.status(200).json({ status: "ignored" });
  } catch (err) {
    console.error(":x: PayPal webhook processing failed:", err);
    return res.status(500).json({ message: "Something went wrong, please try again later" });
  }
};


