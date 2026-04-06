import { Transaction } from "../../models/Transaction.js";
import { Subscription } from "../../models/Subscription.js";
import { EXCHANGE_RATES } from "../../../utils/priceInUSD.js";

export const fetchArtistTransactions = async ({
  artistId,
  itemType,
  status,
  startDate,
  endDate,
}) => {
  const query = { artistId };

  if (itemType) query.itemType = itemType;
  if (status) query.status = status;

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  const transactions = await Transaction.find(query)
    .sort({ createdAt: -1 })
    .lean();

  return transactions.map((txn) => {
    const rate = EXCHANGE_RATES[txn.currency] ?? 1;
    const amountInUSD = txn.amount
      ? Number((txn.amount * rate).toFixed(2))
      : 0;

    return { ...txn, amountInUSD };
  });
};

export const fetchPurchasedItemsByArtist = async (artistId, itemType) => {
  const transactions = await Transaction.find({
    artistId,
    itemType,
    status: "paid",
  }).populate("itemId");

  return transactions.map((tx) => tx.itemId);
};

export const fetchSubscriberStats = async (artistId) => {
  const activeSubs = await Subscription.find({
    artistId,
    status: "active",
    validUntil: { $gt: new Date() },
  });

  const revenueAgg = await Transaction.aggregate([
    {
      $match: {
        artistId,
        itemType: "artist-subscription",
        status: "paid",
      },
    },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: "$amount" },
      },
    },
  ]);

  return {
    activeSubscribers: activeSubs.length,
    totalRevenue: revenueAgg[0]?.totalRevenue || 0,
  };
};

export const fetchArtistRevenueSummary = async (artistId) => {
  const transactions = await Transaction.find({
    artistId,
    status: "paid",
  });

  let songRevenue = 0;
  let albumRevenue = 0;
  let subscriptionRevenue = 0;

  for (const txn of transactions) {
    const usdAmount = txn.amount
      ? EXCHANGE_RATES[txn.currency] * txn.amount
      : 0;

    if (txn.itemType === "song") songRevenue += usdAmount;
    if (txn.itemType === "album") albumRevenue += usdAmount;
    if (txn.itemType === "artist-subscription")
      subscriptionRevenue += usdAmount;
  }

  return {
    songRevenue,
    albumRevenue,
    subscriptionRevenue,
    totalRevenue: songRevenue + albumRevenue + subscriptionRevenue,
  };
};