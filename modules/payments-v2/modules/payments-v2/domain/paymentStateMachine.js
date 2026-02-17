export const PaymentStatus = Object.freeze({
  CREATED: "CREATED",
  PENDING: "PENDING",
  AUTHORIZED: "AUTHORIZED",
  CAPTURED: "CAPTURED",
  FAILED: "FAILED",
  CANCELLED: "CANCELLED",
  REFUNDED: "REFUNDED",
  EXPIRED: "EXPIRED",
});

const allowedTransitions = {
  [PaymentStatus.CREATED]: [
    PaymentStatus.PENDING,
    PaymentStatus.EXPIRED,
  ],

  [PaymentStatus.PENDING]: [
    PaymentStatus.AUTHORIZED,
    PaymentStatus.CAPTURED,
    PaymentStatus.FAILED,
    PaymentStatus.CANCELLED,
    PaymentStatus.EXPIRED,
  ],

  [PaymentStatus.AUTHORIZED]: [
    PaymentStatus.CAPTURED,
  ],

  [PaymentStatus.CAPTURED]: [
    PaymentStatus.REFUNDED,
  ],

  [PaymentStatus.FAILED]: [],
  [PaymentStatus.CANCELLED]: [],
  [PaymentStatus.REFUNDED]: [],
  [PaymentStatus.EXPIRED]: [],
};

/**
 * Validate whether a transition is allowed
 */
export function canTransition(fromStatus, toStatus) {
  if (!fromStatus || !toStatus) {
    throw new Error("Both fromStatus and toStatus are required");
  }

  const allowed = allowedTransitions[fromStatus] || [];
  return allowed.includes(toStatus);
}

/**
 * Enforce transition or throw error
 */
export function assertValidTransition(fromStatus, toStatus) {
  if (!canTransition(fromStatus, toStatus)) {
    throw new Error(
      `Invalid payment state transition: ${fromStatus} → ${toStatus}`
    );
  }
}
