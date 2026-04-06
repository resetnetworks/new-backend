import { executePayment } from "./executePayment.js";
import { markTransactionPaid } from "../domain/transaction.service.js";
import { Transaction } from "../../../models/Transaction.js";
import logger from "../../../utils/logger.js";

export const processPayment = async (payload) => {
  const { paymentId, provider, amount, currency } = payload;

  logger.info({ paymentId, provider }, "Processing payment");

  try {
    // ----------------------------
    // 🔴 STEP 1: Fetch transaction from DB
    // ----------------------------
    const transaction = await findTransactionByPayload(payload);

    if (!transaction) {
      logger.error({ paymentId }, "Transaction not found (possible fraud)");
      return;
    }

    // ----------------------------
    // 🔴 STEP 2: Validate payment integrity
    // ----------------------------
    const isValid = validatePaymentIntegrity(transaction, payload);

    if (!isValid) {
      logger.error(
        { paymentId, transactionId: transaction._id },
        "Payment validation failed"
      );
      return;
    }

    // ----------------------------
    // 🔴 STEP 3: Atomic state change
    // ----------------------------
    const { transaction: updatedTx, isFirstTime } =
      await markTransactionPaid(payload);

    if (!updatedTx || !isFirstTime) {
      logger.warn({ paymentId }, "Duplicate or already processed");
      return;
    }

    // ----------------------------
    // 🔴 STEP 4: Side effects
    // ----------------------------
    await executePayment(updatedTx, payload);

  } catch (err) {
    logger.error(
      { paymentId, err, stack: err.stack },
      "processPayment failed"
    );
    throw err;
  }
};