import mongoose from "mongoose";
import { ArtistLedger } from "../models/ArtistLedger.js";
import { ArtistBalance } from "../models/ArtistBalance.js";
import { EXCHANGE_RATES } from "../../../utils/priceInUSD.js";

/**
 * Credit artist earnings after successful payment
 * This function is IDPOTENT & ATOMIC
 */
export const creditArtistEarnings = async ({
  artistId,
  transactionId,
  amount,
  currency ,
  source, // "song" | "album" | "subscription"
  amountUSD,
}) => {

  if (typeof amountUSD !== "number") {
  throw new Error("amountUSD is required and must be a number");
}
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    // 1️⃣ Idempotency check (ledger already exists?)
    const existingLedger = await ArtistLedger.findOne({
      type: "credit",
      refId: transactionId,
    }).session(session);

    if (existingLedger) {
      // Webhook already processed
      await session.abortTransaction();
      return;
    }

    // 2️⃣ Create ledger entry (SOURCE OF TRUTH)
    await ArtistLedger.create(
      [
        {
          artistId,
          type: "credit",
          source,
          refId: transactionId,
          amount,
          currency,
          amountUSD,
        },
      ],
      { session }
    );

    // 3️⃣ Update or create artist balance
    await ArtistBalance.findOneAndUpdate(
      { artistId },
      {
        $inc: {
          totalEarned: amountUSD,
          availableBalance: amountUSD,
        },
        $setOnInsert: {
          currency: "USD",
        },
      },
      {
        upsert: true,
        new: true,
        session,
      }
    );

    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};
