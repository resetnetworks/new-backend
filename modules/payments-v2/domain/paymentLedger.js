export const LedgerType = Object.freeze({
  CAPTURE: "CAPTURE",
  REFUND: "REFUND",
});

export class PaymentLedger {
  constructor(props) {
    const {
      id,
      paymentIntentId,
      provider,
      providerTransactionId,
      type,
      amountOriginal,
      currencyOriginal,
      amountBase,
      baseCurrency,
      exchangeRate,
      exchangeRateAt = new Date(),
      rawPayload = null,
      createdAt = new Date(),
    } = props;

    // ---- Required validations ----
    if (!paymentIntentId)
      throw new Error("PaymentLedger: paymentIntentId is required");

    if (!provider)
      throw new Error("PaymentLedger: provider is required");

    if (!providerTransactionId)
      throw new Error("PaymentLedger: providerTransactionId is required");

    if (!type || !Object.values(LedgerType).includes(type))
      throw new Error("PaymentLedger: invalid ledger type");

    if (!currencyOriginal)
      throw new Error("PaymentLedger: currencyOriginal is required");

    if (!baseCurrency)
      throw new Error("PaymentLedger: baseCurrency is required");

    if (!exchangeRate || exchangeRate <= 0)
      throw new Error("PaymentLedger: exchangeRate must be > 0");

    if (amountOriginal <= 0)
      throw new Error("PaymentLedger: amountOriginal must be > 0");

    if (amountBase <= 0)
      throw new Error("PaymentLedger: amountBase must be > 0");

    // ---- Assign (Immutable Style) ----
    this.id = id;
    this.paymentIntentId = paymentIntentId;
    this.provider = provider;
    this.providerTransactionId = providerTransactionId;
    this.type = type;
    this.amountOriginal = amountOriginal;
    this.currencyOriginal = currencyOriginal;
    this.amountBase = amountBase;
    this.baseCurrency = baseCurrency;
    this.exchangeRate = exchangeRate;
    this.exchangeRateAt = exchangeRateAt;
    this.rawPayload = rawPayload;
    this.createdAt = createdAt;

    // Freeze to enforce immutability
    Object.freeze(this);
  }
}
