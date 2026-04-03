import { markTransactionPaid } from "../../../services/paymentService.js";
import { creditArtistEarnings } from "../../artist-payout/services/artistEarningService.js";
import { updateUserAfterPurchase } from "../../../services/paymentService.js";
import { processAndSendInvoice } from "../../../services/invoiceService.js";
import  logger  from "../../../utils/logger.js";
import {Transaction } from "../../../models/Transaction.js"

export const executePayment = async (payload) => {
  const { paymentId, subscriptionId } = payload;

  const { transaction, isFirstTime } = await markTransactionPaid(payload);

  // ❌ nothing found → log (important)
  if (!transaction) {
    logger.error({ paymentId }, "Transaction not found");
    return;
  }

  // 🔁 duplicate webhook
  if (!isFirstTime) {
    logger.warn({ paymentId }, "Duplicate webhook ignored");
    return;
  }

  const transactionId = transaction._id;

  // ----------------------------
  // 💰 Earnings
  // ----------------------------
  try {
    await creditArtistEarnings({
      artistId: transaction.artistId,
      transactionId,
      amount: transaction.artistShare,
      currency: transaction.currency,
      amountUSD: transaction.amountUSD,
      source:
        transaction.itemType === "artist-subscription"
          ? "subscription"
          : transaction.itemType,
    });
  } catch (err) {
    logger.error(
      { paymentId, transactionId, err },
      "Earnings failed"
    );
  }

  // ----------------------------
  // 👤 User update
  // ----------------------------
  try {
    await updateUserAfterPurchase(
      transaction,
      subscriptionId || paymentId
    );
  } catch (err) {
    logger.error(
      { paymentId, transactionId, err },
      "User update failed"
    );
  }

  // ----------------------------
  // 🧾 Invoice (async + tracked)
  // ----------------------------
  try {
    const invoiceNumber = await getNextInvoiceNumber();

    // save invoice state
    await Transaction.updateOne(
      { _id: transactionId },
      {
        $set: {
          invoiceNumber,
          invoiceStatus: "pending",
        },
      }
    );

    // async processing
    processAndSendInvoice({
      ...transaction.toObject(),
      invoiceNumber,
    })
      .then(async () => {
        await Transaction.updateOne(
          { _id: transactionId },
          { $set: { invoiceStatus: "sent" } }
        );
      })
      .catch(async (err) => {
        logger.error(
          { paymentId, transactionId, err },
          "Invoice async failed"
        );

        await Transaction.updateOne(
          { _id: transactionId },
          {
            $set: {
              invoiceStatus: "failed",
              invoiceError: err.message,
            },
          }
        );
      });

  } catch (err) {
    logger.error(
      { paymentId, transactionId, err },
      "Invoice generation failed"
    );
  }
};