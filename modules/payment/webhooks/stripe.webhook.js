import { stripe } from "../providers/stripe.client.js";
import { Transaction } from "../../../models/Transaction.js";
import { Subscription } from "../../../models/Subscription.js";
import { WebhookEventLog } from "../../../models/WebhookEventLog.js";
import { markTransactionPaid, updateUserAfterPurchase } from "../../../services/paymentService.js";
import { processAndSendInvoice, processAndSendCancellationInvoice } from "../../../services/invoiceService.js";

const PLATFORM_FEE_PERCENT = 0.15;

export const handleStripeWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("❌ Signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // ✅ Idempotency protection
  const exists = await WebhookEventLog.findOne({ eventId: event.id });
  if (exists) return res.json({ received: true });

  // improve logging for debugging
  // if (exists) {
  // await WebhookEventLog.create({
  //   eventId: event.id,
  //   type: event.type,
  //   rawData: event,
  //   status: "skipped",
  // }).catch(() => {}); // ignore unique errors

  // return res.json({ received: true });

  try {
    switch (event.type) {

      // ===================================================
      // ✅ ONE-TIME PAYMENT (Checkout mode: payment)
      // ===================================================
      case "checkout.session.completed": {
        const session = event.data.object;

        if (session.mode === "payment" && session.payment_status === "paid") {

          const transactionId = session.metadata.transactionId;
          const paymentIntentId = session.payment_intent;
          console.log("👉 👉 👉 👉 session data, :", session);
          console.log("👉 👉 👉 👉 session paymentIntent :", paymentIntentId);

          // 1️⃣ First update transaction with paymentIntentId
          await Transaction.findByIdAndUpdate(transactionId, {
            paymentIntentId,
            stripeSessionId: session.id,
          });

          // 2️⃣ Now call the service (it can find it)
          const transaction = await markTransactionPaid({
            gateway: "stripe",
            paymentIntentId,
          });

          // console.log("👉 👉 👉 👉 👉 markTransactionPaid result :", transaction);

          if (!transaction) {
            console.log("❌ ❌ ❌ ❌ Transaction already processed or not found");
            break;
          }

          // optional: store stripe session info
          transaction.stripeSessionId = session.id;
          transaction.paymentIntentId = paymentIntentId;
          transaction.paidAt = new Date();
          await transaction.save();
          console.log("✅ Transaction marked as paid:", transaction._id);

          // 🔥 Update user access
          await updateUserAfterPurchase(transaction, paymentIntentId);
          console.log("✅ User access updated for transaction:", transaction._id);

          // 🔥 Send invoice
          await processAndSendInvoice(transaction);

          // new-centralized-email-service-activated
          // await EmailService.sendOneTimeInvoice(transaction._id);

          console.log("✅ One-time payment successful:", transactionId);
        }

        // ===================================================
        // ✅ FIRST SUBSCRIPTION PAYMENT
        // ===================================================
        if (session.mode === "subscription" && session.payment_status === "paid") {

          const transactionId = session.metadata.transactionId;
          const stripeSubscriptionId = session.subscription;

          console.log("👉 👉 👉 👉 First stripeSubscriptionId - subscription ID:", session.subscription);

          if (!stripeSubscriptionId) {
            console.error("Missing Stripe subscription ID");
            break;
          }

          console.log("👉 👉 👉 👉 First subscription session:", session.id);

          // 1️⃣ Attach subscription + session ID to transaction
          const txn = await Transaction.findByIdAndUpdate(transactionId, {
            stripeSubscriptionId,
            stripeSessionId: session.id,
            metadata: {
              ...session.metadata,   // ⭐ stores cycle here
            },
          });

          console.log("💥 💥 💥 💥 💥 💥 💥 💥 💥 💥 💥 💥 💥 💥 💥 ");
          console.log("INSIDE THE FIRST SUBSCRIPTION TRSANSX - look for validUntil and invoiceNumber-string : ", txn)
          console.log("💥 💥 💥 💥 💥 💥 💥 💥 💥 💥 💥 💥 💥 💥 💥 ");

          // 2️⃣ Mark as paid (same as one-time)
          const transaction = await markTransactionPaid({
            gateway: "stripe",
            stripeSubscriptionId,
          });

          if (!transaction) {
            console.log("Subscription already processed or not found:", transactionId);
            break;
          }

          console.log("✅ Subscription transaction marked as paid:", transaction._id);

          // 3️⃣ Update user access (this will upsert Subscription)
          await updateUserAfterPurchase(transaction, stripeSubscriptionId);

          console.log("✅ User subscription updated:", transaction._id);

          // 4️⃣ Send invoice
          await processAndSendInvoice(transaction);

          console.log("✅ First subscription fully processed:", transaction._id);
          console.log("👉 👉 👉 👉 ✅ Subscription upserted:", stripeSubscriptionId);
        }

        break;
      }

      // ===================================================
      // 🔁 RECURRING SUBSCRIPTION RENEWAL SUCCESS
      // ===================================================
      case "invoice.payment_succeeded": {
        const invoice = event.data.object;

        // Ignore non-subscription invoices
        const stripeSubscriptionId =
          invoice.subscription ||
          invoice.parent?.subscription_details?.subscription;

        if (!stripeSubscriptionId) {
          console.log("🔁 No subscription found on invoice:", invoice.id);
          break;
        }

        const subscription = await Subscription.findOne({
          externalSubscriptionId: stripeSubscriptionId,
        });
        // console.log("🔁 subscription:", subscription);

        if (!subscription) {
          console.error("Subscription not found in DB for renewal:", stripeSubscriptionId);
          break; // never auto-create on renewal
        }

        // Idempotency for renewal transaction
        const existingRenewal = await Transaction.findOne({
          stripeInvoiceId: invoice.id,
        });

        if (existingRenewal) break;

        const amount = invoice.amount_paid / 100;
        const platformFee = Math.round(amount * PLATFORM_FEE_PERCENT);
        const artistShare = amount - platformFee;

        // 🔥 Get correct period from invoice
        // const stripeSub = await stripe.subscriptions.retrieve(
        //   stripeSubscriptionId
        // );

        // const line = invoice.lines.data[0];

        // const startedAt = new Date(line.period.start * 1000);
        // const validUntil = new Date(line.period.end * 1000);
        // const cycle = stripeSub.metadata?.cycle;

        // Create new transaction for renewal
        // await Transaction.create({
        //   userId: subscription.userId,
        //   artistId: subscription.artistId,
        //   itemId: subscription.artistId, // i have added this cause renwal req this field for transaction which is req.
        //   itemType: "artist-subscription",
        //   amount,
        //   currency: invoice.currency,
        //   gateway: "stripe",
        //   status: "paid",
        //   platformFee,
        //   artistShare,
        //   stripeSubscriptionId,
        //   stripeInvoiceId: invoice.id,
        //   paidAt: new Date(),
        //   invoiceNumber: `INV-${Date.now()}` // 🔥 Important
        // });

        // ✅ 1️⃣ Create renewal transaction as PENDING
        const renewalTransaction = await Transaction.create({
          userId: subscription.userId,
          artistId: subscription.artistId,
          itemId: subscription.artistId,
          itemType: "artist-subscription",
          amount,
          currency: invoice.currency,
          gateway: "stripe",
          status: "pending", // 🔥 IMPORTANT
          platformFee,
          artistShare,
          stripeSubscriptionId,
          stripeInvoiceId: invoice.id,
        });

        // ✅ 2️⃣ Mark transaction paid using existing service
        const paidTransaction = await markTransactionPaid({
          gateway: "stripe",
          // stripeSubscriptionId,
          // paymentIntentId: invoice.payment_intent, // 🔥 Use payment_intent for better reliability
          stripeInvoiceId: invoice.id,
        });

        if (!paidTransaction) {
          console.error("❌ ❌ ❌ ❌ Failed to mark renewal transaction as paid:", paidTransaction);
          break;
        }

        paidTransaction.paidAt = new Date();
        await paidTransaction.save();

        // ✅ 3️⃣ Update user + extend subscription
        await updateUserAfterPurchase(paidTransaction, stripeSubscriptionId);

        // ✅ 4️⃣ Send renewal invoice email
        await processAndSendInvoice(paidTransaction);

        console.log("🔁 Subscription renewed:", stripeSubscriptionId);

        // 🔥 Update subscription period properly
        // subscription.status = "active";
        // subscription.validUntil = validUntil;
        // subscription.cycle = cycle;

        // await subscription.save();

        // console.log("🔁 Subscription renewed:", stripeSubscriptionId);
        break;
      }

      // ===================================================
      // ❌ SUBSCRIPTION RENEWAL FAILED
      // ===================================================
      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const subscriptionId = invoice.subscription;

        await Subscription.findOneAndUpdate(
          { externalSubscriptionId: subscriptionId },
          { status: "past_due" }
        );

        console.warn("❌ Subscription payment failed:", subscriptionId);
        break;
      }

      // ===================================================
      // 🚫 SUBSCRIPTION CANCELLED
      // ===================================================
      case "customer.subscription.deleted": {
        const subscription = event.data.object;

        const subscriptionData = await Subscription.findOneAndUpdate(
          { externalSubscriptionId: subscription.id },
          { status: "cancelled", isRecurring: false },
          { new: true }
        );

        console.log("👉 👉 👉 👉 👉 👉 👉 👉 👉 👉 👉 👉 👉 ")
        console.log("subscribe data from cancellation trigger:", subscriptionData)
        console.log("👉 👉 👉 👉 👉 👉 👉 👉 👉 👉 👉 👉 👉 ")

        // log Stripe cancellation immediately
        console.warn("🚫 Subscription cancelled:", subscription.id);

        // only run side-effects if DB record exists (no early break)
        if (subscriptionData) {
          await processAndSendCancellationInvoice(subscriptionData);
        }
        break;
      }

      default:
        console.log("Unhandled event type:", event.type);
    }

    // ✅ Log processed event
    await WebhookEventLog.create({
      eventId: event.id,
      type: event.type,
      rawData: event,
      status: "processed", // explicitly mark success
    });

    return res.json({ received: true });

  } catch (err) {
    console.error("❌ Webhook processing error:", err);
    return res.status(500).json({ error: "Webhook failed" });
  }
};
