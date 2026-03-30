import { executePayment } from "./payment.executor.js";
import logger from "../../../utils/logger.js";

export const processPayment = async (payload) => {
  const { paymentId, type, gateway } = payload;

  logger.info(
    { paymentId, type, gateway },
    "Processing payment"
  );

  try {
    // ----------------------------
    // 🔥 Future hook: validation
    // ----------------------------
    // validatePaymentAmount(payload);
    // applyCoupon(payload);

    // ----------------------------
    // 🔥 Route by type (future-proof)
    // ----------------------------
    switch (type) {
      case "one-time":
      case "subscription":
        return await executePayment(payload);

      default:
        logger.warn(
          { paymentId, type },
          "Unsupported payment type"
        );
        return;
    }

  } catch (err) {
    logger.error(
      {
        paymentId,
        error: err.message,
        stack: err.stack,
      },
      "processPayment failed"
    );

    throw err;
  }
};