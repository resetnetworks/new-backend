import { Subscription } from "../../../models/Subscription.js";
import { Transaction } from "../../../models/Transaction.js";
import { Artist } from "../../../models/Artist.js";
import { BadRequestError, NotFoundError } from "../../../errors/index.js";
import { getSubscriptionAmount } from "../../../utils/getSubscriptionAmount.js";
  import { createRazorpaySubscriptionAPI } from "../gateway/razorpay/razorpay.subscription.js";
import logger from "../../../utils/logger.js";

const PLATFORM_FEE_PERCENT = 0.15;
export const createSubscription = async ({
  gateway,
  user,
  artistId,
  cycle,
}) => {
  // ----------------------------
  // 1️⃣ Validate cycle
  // ----------------------------
  const validCycles = ["1m", "3m", "6m", "12m"];
  if (!validCycles.includes(cycle)) {
    throw new BadRequestError("Invalid subscription cycle");
  }

  // ----------------------------
  // 2️⃣ Block ACTIVE
  // ----------------------------
  const activeSub = await Subscription.findOne({
    userId: user._id,
    artistId,
    status: "active",
  });

  if (activeSub) {
    throw new BadRequestError("Already subscribed");
  }

  // ----------------------------
  // 3️⃣ Handle PENDING
  // ----------------------------
  const pendingSub = await Subscription.findOne({
    userId: user._id,
    artistId,
    status: "pending",
  });

  if (pendingSub) {
    const isStale =
      Date.now() - new Date(pendingSub.createdAt).getTime() >
      10 * 60 * 1000;

    if (isStale) {
      await Subscription.deleteOne({ _id: pendingSub._id });
      logger.warn(
        { userId: user._id, artistId },
        "Stale pending subscription removed"
      );
    } else {
      throw new BadRequestError(
        "Subscription is being processed. Please wait."
      );
    }
  }

  // ----------------------------
  // 4️⃣ Fetch artist + plan
  // ----------------------------
  const artist = await Artist.findById(artistId).select(
    "subscriptionPlans name"
  );

  if (!artist) throw new NotFoundError("Artist not found");

  const plan = artist.subscriptionPlans.find(
    (p) => p.cycle === cycle
  );

  if (!plan || !plan.razorpayPlanId) {
    throw new NotFoundError(`No plan for cycle ${cycle}`);
  }

  const amount = getSubscriptionAmount(plan, "INR");

  // ----------------------------
  // 5️⃣ Gateway call
  // ----------------------------
  let externalSub;

  if (gateway === "razorpay") {
    externalSub = await createRazorpaySubscriptionAPI({
      planId: plan.razorpayPlanId,
      userId: user._id,
      artistId,
      cycle,
    });
  } else {
    throw new Error("Unsupported gateway");
  }

  // ----------------------------
  // 6️⃣ Create transaction
  // ----------------------------
  const platformFee = Math.round(amount * PLATFORM_FEE_PERCENT);
  const artistShare = amount - platformFee;

  const transaction = await Transaction.create({
    userId: user._id,
    itemType: "artist-subscription",
    itemId: artistId,
    artistId,
    amount,
    platformFee,
    artistShare,
    currency: "INR",
    gateway,
    status: "pending",
    metadata: {
      externalSubscriptionId: externalSub.id,
      userId: user._id,
      artistId,
      cycle,
    },
  });

  // ----------------------------
  // 7️⃣ Create subscription
  // ----------------------------
  await Subscription.create({
    userId: user._id,
    artistId,
    externalSubscriptionId: externalSub.id,
    cycle,
    gateway,
    status: "pending",
    startedAt: new Date(),
    validUntil: new Date("2030-01-01"), // temp
    transactionId: transaction._id,
  });

  return {
    success: true,
    subscriptionId: externalSub.id,
    cycle,
  };
};