import { creditArtistEarnings } from "../domain/earnings.service.js";
import { updateUserAfterPurchase } from "../domain/transaction.service.js";
import { processAndSendInvoice } from "../../../services/invoiceService.js";
import { Transaction } from "../../../models/Transaction.js";
import logger from "../../../utils/logger.js";

export const executePayment = async (transaction, payload) => {
  const transactionId = transaction._id;
  const paymentId = payload.paymentId;
  const now = new Date();

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

    await Transaction.updateOne(
      { _id: transactionId },
      {
        $set: {
          "processing.earnings.status": "done",
          "processing.earnings.lastAttemptAt": now,
          "processing.earnings.error": null,
        },
      }
    );

  } catch (err) {
    logger.error({ err, paymentId, transactionId }, "Earnings failed");

    await Transaction.updateOne(
      { _id: transactionId },
      {
        $set: {
          "processing.earnings.status": "failed",
          "processing.earnings.lastAttemptAt": now,
          "processing.earnings.error": err.message,
        },
      }
    );
  }

  // ----------------------------
  // 👤 User update
  // ----------------------------
  try {
    await updateUserAfterPurchase(transaction, paymentId);

    await Transaction.updateOne(
      { _id: transactionId },
      {
        $set: {
          "processing.userUpdate.status": "done",
          "processing.userUpdate.lastAttemptAt": now,
          "processing.userUpdate.error": null,
        },
      }
    );

  } catch (err) {
    logger.error({ err, paymentId, transactionId }, "User update failed");

    await Transaction.updateOne(
      { _id: transactionId },
      {
        $set: {
          "processing.userUpdate.status": "failed",
          "processing.userUpdate.lastAttemptAt": now,
          "processing.userUpdate.error": err.message,
        },
      }
    );
  }

  // ----------------------------
  // 🧾 Invoice (async + tracked)
  // ----------------------------
  try {
    processAndSendInvoice(transaction.toObject())
      .then(async () => {
        await Transaction.updateOne(
          { _id: transactionId },
          {
            $set: {
              "processing.invoice.status": "sent",
              "processing.invoice.lastAttemptAt": new Date(),
              "processing.invoice.error": null,
            },
          }
        );
      })
      .catch(async (err) => {
        logger.error(
          { err, paymentId, transactionId },
          "Invoice async failed"
        );

        await Transaction.updateOne(
          { _id: transactionId },
          {
            $set: {
              "processing.invoice.status": "failed",
              "processing.invoice.lastAttemptAt": new Date(),
              "processing.invoice.error": err.message,
            },
          }
        );
      });

  } catch (err) {
    logger.error(
      { err, paymentId, transactionId },
      "Invoice trigger failed"
    );

    await Transaction.updateOne(
      { _id: transactionId },
      {
        $set: {
          "processing.invoice.status": "failed",
          "processing.invoice.lastAttemptAt": now,
          "processing.invoice.error": err.message,
        },
      }
    );
  }
};