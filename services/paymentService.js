import { Transaction } from "../models/Transaction.js";
import { User } from "../models/User.js";
import { Subscription } from "../models/Subscription.js";
import { getNextInvoiceNumber } from "../utils/invoiceNumber.js";
import mongoose from "mongoose";
import { creditArtistEarnings } from "../modules/artist-payout/services/artistEarningService.js";
import { EXCHANGE_RATES } from "../utils/priceInUSD.js";
const subscriptionDuration = {
  "1m": 30,   // 30 days
  "3m": 90,   // 90 days
  "6m": 180   // 180 days
};
// ✅ Mark transaction as paid
// export const markTransactionPaid = async ({
//   gateway,
//   paymentId,
//   razorpayOrderId,
//   paymentIntentId,
//   stripeSubscriptionId,
//   subscriptionId,
// }) => {
//   let query = {};
//   console.log("🔍 Marking transaction as paid:")
// console.log({ gateway, paymentId, razorpayOrderId, paymentIntentId, stripeSubscriptionId, subscriptionId });
// console.log("Searching with query:", query);
//   if (!gateway) {
//     console.warn("⚠️ No payment gateway provided. Cannot mark transaction as paid.");
//     return null;
//   }
//   if (gateway === "stripe") {
//     if (stripeSubscriptionId) {
//       query = { stripeSubscriptionId };
//     } else {
//       query = { paymentIntentId };
//     }
//   } else if(gateway === "razorpay") {
//     if (subscriptionId) {
//       query = { "metadata.razorpaySubscriptionId": subscriptionId };
//     } else if (razorpayOrderId) {
//       query = { razorpayOrderId };
//     } else if (paymentId) {
//       query = { paymentId }; 
//     }
//   }
//   else if (gateway === "paypal") {
//     if (subscriptionId) {
//       query = { "metadata.paypalSubscriptionId": subscriptionId };
//     } else if (paymentId) {
//       query = { paypalOrderId:paymentId };
//     }
//   }
// console.log("Final query for transaction:", query);

//    const transaction = await Transaction.findOne({
//   ...query,
//   status: "pending",
// }).sort({ createdAt: -1 });
//   console.log("Found transaction:", transaction);
//   if (!transaction || transaction.status === "paid") {
//     console.warn("⚠️ Transaction not found or already marked as paid");
    
    
//     return null;
//   }

//   transaction.status = "paid";
//   const invoiceNumber = await getNextInvoiceNumber();
// // Save invoiceNumber in Transaction document
// transaction.invoiceNumber = invoiceNumber;
//   await transaction.save();


//   // / 4️⃣ 💰 CREDIT ARTIST EARNINGS (CENTRALIZED HERE)
//   await creditArtistEarnings({
//     artistId: transaction.artistId,
//     transactionId: transaction._id,
//     amount: transaction.artistShare,
//     currency: transaction.currency,
//     source:
//       transaction.itemType === "artist-subscription"
//         ? "subscription"
//         : transaction.itemType,
//   });
//   return transaction;
// };

export const markTransactionPaid = async ({
  gateway,
  paymentId,
  razorpayOrderId,
  paymentIntentId,
  stripeSubscriptionId,
  subscriptionId,
}) => {
  if (!gateway) return null;

  let query = {};

  // ----------------------------
  // Build gateway-specific query
  // ----------------------------
  // if (gateway === "stripe") {
  //   query = stripeSubscriptionId
  //     ? { stripeSubscriptionId }
  //     : { paymentIntentId };
  // }

  if (gateway === "stripe") {
    if (stripeSubscriptionId) {
      query = { stripeSubscriptionId };
    } else if (paymentIntentId) {
      query = { paymentIntentId };
    }
  }

  if (gateway === "razorpay") {
    if (subscriptionId) {
      query = { "metadata.razorpaySubscriptionId": subscriptionId };
    } else if (razorpayOrderId) {
      query = { razorpayOrderId };
    } else if (paymentId) {
      query = { paymentId };
    }
  }

  if (gateway === "paypal") {
    query = subscriptionId
      ? { "metadata.paypalSubscriptionId": subscriptionId }
      : { paypalOrderId: paymentId };
  }

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    // ----------------------------
    // Find transaction (NO status filter)
    // ----------------------------
    const transaction = await Transaction.findOne(query).session(session);

    if (!transaction) {
      await session.abortTransaction();
      return null;
    }

    // ----------------------------
// Idempotency guard
// ----------------------------
if (transaction.status === "paid") {
  await session.abortTransaction();
  return transaction;
}

// ----------------------------
// Mark transaction as paid
// ----------------------------
transaction.status = "paid";
transaction.invoiceNumber = await getNextInvoiceNumber();
const rate = EXCHANGE_RATES[transaction.currency];

if (!rate) {
  throw new Error(`Unsupported currency: ${transaction.currency}`);
}

transaction.amountUSD = Number(
  (transaction.artistShare * rate).toFixed(2)
);

transaction.exchangeRate = rate;
transaction.exchangeRateSource = "static";
transaction.exchangeRateAt = new Date();

await transaction.save({ session });

    // ----------------------------
    // Credit artist earnings
    // ----------------------------
    await creditArtistEarnings({
      artistId: transaction.artistId,
      transactionId: transaction._id,
      amount: transaction.artistShare,
      currency: transaction.currency,
      amountUSD: transaction.amountUSD,
      source:
        transaction.itemType === "artist-subscription"
          ? "subscription"
          : transaction.itemType,
    });

    await session.commitTransaction();
    return transaction;

  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};


// ✅ Update user after payment
export const updateUserAfterPurchase = async (transaction, paymentId) => {
  const updateOps = {};

  console.log("🔄.  🔄.  🔄.  🔄.  🔄.  🔄.  🔄.  🔄.  🔄.  🔄.  Updating user after purchase - transaction:", transaction);

  // ✅ Push purchaseHistory entry (no duplicates)
  // updateOps.$push = {
  //   purchaseHistory: {
  //     itemType: transaction.itemType,
  //     itemId: transaction.itemId,
  //     price: transaction.amount,
  //     amount: transaction.amount,
  //     currency: transaction.currency,
  //     paymentId,
  //   },
  // };

   // ✅ Store transaction reference only
  updateOps.$push = {
    purchaseHistory: {
      transactionId: transaction._id,
      itemType: transaction.itemType,
    },
  };


  switch(transaction.itemType) {
    case "song":
      updateOps.$addToSet = {
        ...updateOps.$addToSet,
        purchasedSongs: transaction.itemId,
      };
      break;

    case "album":
      updateOps.$addToSet = {
        ...updateOps.$addToSet,
        purchasedAlbums: transaction.itemId,
      };
      break;

    case "artist-subscription": {
      console.log("🔄 🔄 🔄 🔄 🔄 🔄 🔄 🔄 🔄 🔄 🔄 🔄 Processing artist subscription transaction:", transaction);
      const daysToAdd = subscriptionDuration[transaction.metadata?.cycle] || 30;
      let validUntil = new Date(Date.now() + daysToAdd * 24 * 60 * 60 * 1000);

      const fallbackExternalId =
        transaction.metadata?.externalSubscriptionId ??
        transaction.metadata?.razorpaySubscriptionId ??
        transaction.metadata?.paypalSubscriptionId ??
        transaction.stripeSubscriptionId ??
        transaction.paymentIntentId ??
        transaction.razorpayOrderId ??
        "unknown";

      // 🧠 Optionally enrich with Stripe’s actual period
      if (transaction.stripeSubscriptionId) {
        try {
          const stripe = new (await import("stripe")).default(process.env.STRIPE_SECRET_KEY);
          const stripeSub = await stripe.subscriptions.retrieve(transaction.stripeSubscriptionId);
          if (stripeSub?.current_period_end) {
            validUntil = new Date(stripeSub.current_period_end * 1000);
          }
        } catch (err) {
          console.warn("⚠️ Failed to fetch Stripe period:", err.message);
        }
      }

      // ✅ Upsert subscription
      await Subscription.findOneAndUpdate(
        { userId: transaction.userId, artistId: transaction.artistId },
        {
          status: "active",
          validUntil,
          gateway: transaction.gateway,
          externalSubscriptionId: fallbackExternalId,
          transactionId: transaction._id,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      console.log("✅ Subscription created/updated for artist:", transaction.artistId);
      break;
    }

    default:
      console.warn("⚠️ Unknown itemType:", transaction.itemType);

  }

  // switch (transaction.itemType) {
  //   case "song":
  //     updateOps.$addToSet = { purchasedSongs: transaction.itemId };
  //     break;

  //   case "album":
  //     updateOps.$addToSet = { purchasedAlbums: transaction.itemId };
  //     break;

  //   case "artist-subscription": {
  //     const daysToAdd = subscriptionDuration[transaction.metadata?.cycle] || 30;
  //     let validUntil = new Date(Date.now() + daysToAdd * 24 * 60 * 60 * 1000);

  //     const fallbackExternalId =
  //       transaction.metadata?.externalSubscriptionId ??
  //       transaction.metadata?.razorpaySubscriptionId ??
  //       transaction.metadata?.paypalSubscriptionId ??
  //       transaction.stripeSubscriptionId ??
  //       transaction.paymentIntentId ??
  //       transaction.razorpayOrderId ??
  //       "unknown";

  //     // 🧠 Optionally enrich with Stripe’s actual period
  //     if (transaction.stripeSubscriptionId) {
  //       try {
  //         const stripe = new (await import("stripe")).default(process.env.STRIPE_SECRET_KEY);
  //         const stripeSub = await stripe.subscriptions.retrieve(transaction.stripeSubscriptionId);
  //         if (stripeSub?.current_period_end) {
  //           validUntil = new Date(stripeSub.current_period_end * 1000);
  //         }
  //       } catch (err) {
  //         console.warn("⚠️ Failed to fetch Stripe period:", err.message);
  //       }
  //     }

  //     // ✅ Upsert subscription
  //     await Subscription.findOneAndUpdate(
  //       { userId: transaction.userId, artistId: transaction.artistId },
  //       {
  //         status: "active",
  //         validUntil,
  //         gateway: transaction.gateway,
  //         externalSubscriptionId: fallbackExternalId,
  //         transactionId: transaction._id,
  //       },
  //       { upsert: true, new: true, setDefaultsOnInsert: true }
  //     );

  //     console.log("✅ Subscription created/updated for artist:", transaction.artistId);
  //     break;
  //   }

  //   default:
  //     console.warn("⚠️ Unknown itemType:", transaction.itemType);
  // }

  // ✅ Atomic update instead of load+save
  
  const user = await User.findByIdAndUpdate(transaction.userId, updateOps, { new: true });
  if (!user) {
    console.warn("❌ User not found for transaction:", transaction._id);
    return false;
  }

  console.log("✅ User updated:", user._id);
  return true;
};

