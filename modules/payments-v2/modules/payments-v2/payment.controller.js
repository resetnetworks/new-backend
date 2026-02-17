import crypto from "crypto";
import PaymentIntentModel from "./persistence/paymentIntent.model.js";
import { PaymentIntent } from "./domain/paymentIntent.js";
import { PaymentStatus } from "./domain/paymentStateMachine.js";
import { getProviderAdapter } from "./providers/providerFactory.js";

const PLATFORM_FEE_PERCENT = 0.15;

export const createPaymentIntent = async (req, res) => {
  try {
    const { type, referenceId, provider, amount, currency } = req.body;
    const userId = req.user._id;

    if (!type || !referenceId || !provider || !amount || !currency) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // 1️⃣ Calculate split
    const platformFee = Math.round(amount * PLATFORM_FEE_PERCENT);
    const artistAmount = amount - platformFee;

    // 2️⃣ Generate idempotency key
    const idempotencyKey = crypto.randomUUID();

    // 3️⃣ Create PaymentIntent domain object
    const intent = new PaymentIntent({
      userId,
      type,
      referenceId,
      provider,
      amount,
      currency,
      platformFee,
      artistAmount,
      idempotencyKey,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 mins
    });

    // 4️⃣ Persist intent (CREATED)
    const savedIntent = await PaymentIntentModel.create({
      ...intent,
      status: PaymentStatus.PENDING,
    });

    // 5️⃣ Call provider adapter to create order
    const adapter = getProviderAdapter(provider);

    const providerResponse = await adapter.createOrder({
      amount,
      currency,
      idempotencyKey,
      referenceId,
      paymentIntentId: savedIntent._id,
    });

    // 6️⃣ Attach providerRefId
    await PaymentIntentModel.updateOne(
      { _id: savedIntent._id },
      { providerRefId: providerResponse.providerRefId }
    );

    return res.status(201).json({
      success: true,
      paymentIntentId: savedIntent._id,
      providerData: providerResponse.clientData,
    });

  } catch (err) {
    console.error("CreatePaymentIntent error:", err);
    return res.status(500).json({ message: "Failed to create payment intent" });
  }
};
