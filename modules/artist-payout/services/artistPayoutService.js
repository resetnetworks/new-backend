import mongoose from "mongoose";
import { ArtistBalance } from "../models/ArtistBalance.js";
import { ArtistLedger } from "../models/ArtistLedger.js";
import { ArtistPayout } from "../models/ArtistPayout.js";
import { BadRequestError } from "../../../errors/index.js";

export const requestArtistPayout = async ({
  artistId,
  amount,
  paypalEmail,
  currency = "USD",
}) => {
  if (amount <= 0) {
    throw new BadRequestError("Invalid payout amount");
  }

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    // 1️⃣ Fetch artist balance
    const balance = await ArtistBalance.findOne({ artistId }).session(session);

    if (!balance || balance.availableBalance < amount) {
      throw new BadRequestError("Insufficient balance");
    }

    // 2️⃣ Create payout request
    const payout = await ArtistPayout.create(
      [
        {
          artistId,
          amount,
          currency,
          paypalEmail,
          status: "requested",
        },
      ],
      { session }
    );

    // 3️⃣ Create ledger DEBIT
    await ArtistLedger.create(
      [
        {
          artistId,
          type: "debit",
          source: "payout",
          refId: payout[0]._id,
          amountUSD: amount,
          amount,
          currency,
        },
      ],
      { session }
    );

    // 4️⃣ Update artist balance
    balance.availableBalance -= amount;
    balance.totalPaidOut += amount;
    await balance.save({ session });

    await session.commitTransaction();
    return payout[0];
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};
