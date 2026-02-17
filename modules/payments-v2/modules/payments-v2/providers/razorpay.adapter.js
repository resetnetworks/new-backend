import crypto from "crypto";
import Razorpay from "razorpay";

export class RazorpayAdapter {
  constructor() {
    this.webhookSecret = process.env.RAZORPAY_KEY_SECRET;
    this.razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }

  // ----------------------------------
  // 1️⃣ Verify Signature
  // ----------------------------------
  verifySignature(req) {
    const signature = req.headers["x-razorpay-signature"];
    const rawBody = req.body;

    if (!signature || !rawBody) return false;

    const expectedSignature = crypto
      .createHmac("sha256", this.webhookSecret)
      .update(rawBody)
      .digest("hex");

    return signature === expectedSignature;
  }

  // ----------------------------------
  // 2️⃣ Extract Event ID
  // ----------------------------------
  extractEventId(rawPayload) {
    // Razorpay sends event ID in payload
    return rawPayload?.payload?.payment?.entity?.id || rawPayload?.event;
  }

  // ----------------------------------
  // 3️⃣ Extract Event Type
  // ----------------------------------
  extractEventType(rawPayload) {
    return rawPayload?.event;
  }

  // ----------------------------------
  // 4️⃣ Normalize Webhook
  // ----------------------------------
  parseWebhook(rawPayload) {
    const event = rawPayload.event;

    // ----------------------------
    // PAYMENT CAPTURED
    // ----------------------------
    if (event === "payment.captured") {
      const paymentEntity = rawPayload.payload?.payment?.entity;

      if (!paymentEntity) {
        throw new Error("Invalid Razorpay payment payload");
      }

      return {
        type: "PAYMENT_CAPTURED",
        data: {
          provider: "razorpay",
          providerTransactionId: paymentEntity.id,
          providerRefId: paymentEntity.order_id,
          amount: paymentEntity.amount / 100, // paise → INR
          currency: paymentEntity.currency,
          exchangeRate: 1, // replace with FX service later
          rawPayload,
        },
      };
    }

    // ----------------------------
    // PAYMENT FAILED
    // ----------------------------
    if (event === "payment.failed") {
      return {
        type: "PAYMENT_FAILED",
        data: {
          provider: "razorpay",
          rawPayload,
        },
      };
    }

    // ----------------------------
    // SUBSCRIPTION CHARGED
    // ----------------------------
    if (event === "subscription.charged") {
      const paymentEntity = rawPayload.payload?.payment?.entity;

      return {
        type: "PAYMENT_CAPTURED",
        data: {
          provider: "razorpay",
          providerTransactionId: paymentEntity.id,
          providerRefId: paymentEntity.order_id,
          amount: paymentEntity.amount / 100,
          currency: paymentEntity.currency,
          exchangeRate: 1,
          rawPayload,
        },
      };
    }

    // ----------------------------
    // IGNORE OTHER EVENTS
    // ----------------------------
    return {
      type: "IGNORED",
      data: { rawPayload },
    };
  }

   async createOrder({
    amount,
    currency,
    idempotencyKey,
    referenceId,
    paymentIntentId,
  }) {
    const order = await this.razorpay.orders.create({
      amount: amount * 100, // INR → paise
      currency,
      receipt: idempotencyKey,
      notes: {
        paymentIntentId: paymentIntentId.toString(),
        referenceId: referenceId.toString(),
      },
    });

    return {
      providerRefId: order.id, // This maps to providerRefId
      clientData: {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        key: process.env.RAZORPAY_KEY_ID,
      },
    };
  }
}
  

