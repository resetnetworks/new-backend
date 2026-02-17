import mongoose from "mongoose";
import { WebhookStatus, WebhookEvent } from "../domain/webhookEvent.js";
import { PaymentEngine } from "./paymentEngine.service.js";

import WebhookEventModel from "../persistence/webhookEvent.model.js";
import { getProviderAdapter } from "../providers/providerFactory.js"; 
// we'll create providerFactory next

export class WebhookProcessor {
  constructor() {
    this.paymentEngine = new PaymentEngine();
  }

  async processWebhookEvent(webhookEventId) {
    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      // 1️⃣ Load webhook event
      const eventDoc = await WebhookEventModel.findById(webhookEventId).session(session);

      if (!eventDoc) {
        throw new Error("WebhookEvent not found");
      }

      const webhookEvent = new WebhookEvent(eventDoc.toObject());

      // Idempotency check
      if (webhookEvent.status === WebhookStatus.PROCESSED) {
        await session.abortTransaction();
        return { alreadyProcessed: true };
      }

      // 2️⃣ Mark processing
      webhookEvent.markProcessing();

      await WebhookEventModel.updateOne(
        { _id: webhookEvent.id },
        {
          status: webhookEvent.status,
          attempts: webhookEvent.attempts,
        },
        { session }
      );

      // 3️⃣ Get correct provider adapter
      const adapter = getProviderAdapter(webhookEvent.provider);

     // 4️⃣ Normalize event payload
const normalizedEvent = adapter.parseWebhook(
  webhookEvent.rawPayload
);

// 5️⃣ Route based on event type
switch (normalizedEvent.type) {

  case "PAYMENT_CAPTURED":
    await this.paymentEngine.processCapture(
      normalizedEvent.data
    );
    break;

  case "PAYMENT_FAILED":
    // Optional: implement failure transition
    // await this.paymentEngine.processFailure(normalizedEvent.data);
    break;

  case "IGNORED":
    // Do nothing — mark processed safely
    break;

  default:
    console.warn("Unknown normalized event type:", normalizedEvent.type);
    break;
}
   

      // We only process capture-type events here
      if (normalizedEvent.type === "PAYMENT_CAPTURED") {
        await this.paymentEngine.processCapture(normalizedEvent.data);
      }

      // 5️⃣ Mark as processed
      webhookEvent.markProcessed();

      await WebhookEventModel.updateOne(
        { _id: webhookEvent.id },
        {
          status: webhookEvent.status,
          processedAt: webhookEvent.processedAt,
        },
        { session }
      );

      await session.commitTransaction();

      return { success: true };

    } catch (err) {
      await session.abortTransaction();

      // Mark failed outside transaction
      await WebhookEventModel.findByIdAndUpdate(webhookEventId, {
        status: WebhookStatus.FAILED,
        lastError: err.message,
      });

      throw err;

    } finally {
      session.endSession();
    }
  }
}
