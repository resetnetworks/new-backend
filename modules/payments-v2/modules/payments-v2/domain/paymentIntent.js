import { PaymentStatus, assertValidTransition } from "./paymentStateMachine.js";

export class PaymentIntent {
  constructor(props) {
    const {
      id,
      userId,
      type,
      referenceId,
      provider,
      providerRefId = null,
      amount,
      currency,
      platformFee,
      artistAmount,
      status = PaymentStatus.CREATED,
      idempotencyKey,
      expiresAt,
      createdAt = new Date(),
      updatedAt = new Date(),
    } = props;

    // ---- Required validations ----
    if (!userId) throw new Error("PaymentIntent: userId is required");
    if (!type) throw new Error("PaymentIntent: type is required");
    if (!referenceId) throw new Error("PaymentIntent: referenceId is required");
    if (!provider) throw new Error("PaymentIntent: provider is required");
    if (!currency) throw new Error("PaymentIntent: currency is required");
    if (!idempotencyKey) throw new Error("PaymentIntent: idempotencyKey is required");

    if (amount <= 0) throw new Error("PaymentIntent: amount must be > 0");
    if (platformFee + artistAmount !== amount) {
      throw new Error("PaymentIntent: platformFee + artistAmount must equal amount");
    }

    if (expiresAt && expiresAt < new Date()) {
      throw new Error("PaymentIntent: expiresAt must be in the future");
    }

    // ---- Assign ----
    this.id = id;
    this.userId = userId;
    this.type = type;
    this.referenceId = referenceId;
    this.provider = provider;
    this.providerRefId = providerRefId;
    this.amount = amount;
    this.currency = currency;
    this.platformFee = platformFee;
    this.artistAmount = artistAmount;
    this.status = status;
    this.idempotencyKey = idempotencyKey;
    this.expiresAt = expiresAt;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  // -----------------------------------
  // Domain Methods
  // -----------------------------------

  transitionTo(newStatus) {
    assertValidTransition(this.status, newStatus);
    this.status = newStatus;
    this.updatedAt = new Date();
  }

  attachProviderReference(providerRefId) {
    if (!providerRefId) {
      throw new Error("Provider reference ID required");
    }
    this.providerRefId = providerRefId;
    this.updatedAt = new Date();
  }

  isCaptured() {
    return this.status === PaymentStatus.CAPTURED;
  }

  isFinalState() {
    return [
      PaymentStatus.FAILED,
      PaymentStatus.CANCELLED,
      PaymentStatus.REFUNDED,
      PaymentStatus.EXPIRED,
    ].includes(this.status);
  }
}
