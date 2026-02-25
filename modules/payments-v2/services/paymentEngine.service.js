import mongoose from "mongoose";
import { PaymentIntent } from "../domain/paymentIntent.js";
import { PaymentLedger, LedgerType } from "../domain/paymentLedger.js";
import { PaymentStatus } from "../domain/paymentStateMachine.js";

import PaymentIntentModel from "../persistence/paymentIntent.model.js";
import PaymentLedgerModel from "../persistence/paymentLedger.model.js";

export class PaymentEngine {
  async processCapture(eventData) {
    const {
      provider,
      providerTransactionId,
      providerRefId,
      amount,
      currency,
      rawPayload,
      baseCurrency = "USD",
      exchangeRate,
    } = eventData;

    const session = await mongoose.startSession();

    try {
      session.startTransaction();

      // 1️⃣ Load PaymentIntent from DB
      const intentDoc = await PaymentIntentModel.findOne({
        provider,
        providerRefId,
      }).session(session);

      if (!intentDoc) {
        throw new Error("PaymentIntent not found for providerRefId");
      }

      // 2️⃣ Instantiate Domain Entity
      const intent = new PaymentIntent(intentDoc.toObject());

      // 3️⃣ Idempotency check
      if (intent.isCaptured()) {
        await session.abortTransaction();
        return { alreadyProcessed: true };
      }

      // 4️⃣ Validate amount & currency
      if (intent.amount !== amount) {
        throw new Error("Amount mismatch detected");
      }

      if (intent.currency !== currency) {
        throw new Error("Currency mismatch detected");
      }

      // 5️⃣ Transition state
      intent.transitionTo(PaymentStatus.CAPTURED);

      // 6️⃣ Calculate normalized base amount
      const amountBase = Number(
        (amount * exchangeRate).toFixed(2)
      );

      // 7️⃣ Create immutable ledger entry
      const ledger = new PaymentLedger({
        paymentIntentId: intentDoc._id ,
        provider,
        providerTransactionId,
        type: LedgerType.CAPTURE,
        amountOriginal: amount,
        currencyOriginal: currency,
        amountBase,
        baseCurrency,
        exchangeRate,
        rawPayload,
      });

      // 8️⃣ Persist changes atomically
      await PaymentIntentModel.updateOne(
        { _id: intentDoc._id },
        {
          status: intent.status,
          updatedAt: new Date(),
        },
        { session }
      );

    try {
  await PaymentLedgerModel.create([ledger], { session });
} catch (err) {
  if (err.code === 11000) {
    // Duplicate providerTransactionId → already processed
    await session.abortTransaction();
    return { alreadyProcessed: true };
  }
  throw err;
}

      await session.commitTransaction();

      return {
        success: true,
        paymentIntentId: intent.id,
      };

    } catch (err) {
      await session.abortTransaction();
      throw err;
    } finally {
      session.endSession();
    }
  }
}
