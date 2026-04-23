import { createCheckoutSession } from "../services/stripe.service.js";
import { Transaction } from "../../../models/Transaction.js";
import { Song } from "../../../models/song.model.js";
import { Album } from "../../../models/album.model.js";
import { Artist } from "../../../models/Artist.js";

const PLATFORM_FEE_PERCENT = 0.15;
const ALLOWED_CURRENCIES = ["USD", "EUR", "GBP", "JPY", "INR"];

export const createStripeCheckout = async (req, res) => {
  try {
    const { itemId, itemType, currency = "USD" } = req.body;
    const userId = req.user._id.toString();
   

    if (!["song", "album", "artist"].includes(itemType)) {
      return res.status(400).json({ message: "Invalid item type" });
    }

    let item;

    // 🔍 Fetch correct model
    if (itemType === "song") {
      item = await Song.findById(itemId);
    } else if (itemType === "album") {
      item = await Album.findById(itemId);
    } else if (itemType === "artist") {
      item = await Artist.findById(itemId);
    }

    if (!item) {
      return res.status(404).json({ message: "Item not found" });
    }

    // const amount = item.price || req.body.amount; // error caution - remove this body price fallback in production

    // const currency = (item.currency || req.body.currency).toLowerCase();
    
    if (!item.basePrice || !item.basePrice.amount) {
      return res.status(400).json({ message: "This item is not purchasable" });
    }

    const artistId = item.artist || item._id; // for artist purchase

    const selectedCurrency = currency.toUpperCase();

    if (!ALLOWED_CURRENCIES.includes(selectedCurrency)) {
      return res.status(400).json({ message: "Currency not supported" });
    }

    const priceEntry =
      selectedCurrency === item.basePrice.currency
        ? item.basePrice
        : item.convertedPrices?.find(
            (p) => p.currency === selectedCurrency
          );

    if (!priceEntry) {
      return res.status(400).json({
        message: "Price not available in selected currency",
      });
    }

    const amount = priceEntry.amount;
    const normalizedCurrency = selectedCurrency.toLowerCase();

    // 💰 Calculate platform fee
    const platformFee = Math.round(amount * PLATFORM_FEE_PERCENT * 100) / 100;
    const artistShare = Math.round((amount - platformFee) * 100) / 100;

    // 🧾 Create pending transaction
    const transaction = await Transaction.create({
      userId,
      itemType,
      itemId,
      artistId,
      gateway: "stripe",
      amount,
      currency: selectedCurrency,
      status: "pending",
      platformFee,
      artistShare,
    });

    // 💳 Create Stripe Checkout session (ONE-TIME PAYMENT)

    const session = await createCheckoutSession({
      amount,
      currency: normalizedCurrency,
      userId,
      itemId,
      itemType,
      transactionId: transaction._id.toString(),
    });

    // Save session ID
    transaction.metadata = {
      checkoutSessionId: session.id,
    };

    await transaction.save();

    return res.status(200).json({
      checkoutUrl: session.url,
    });

  } catch (error) {
    console.error("Stripe Checkout Error:", error);
    return res.status(500).json({
      message: "Unable to create checkout session",
    });
  }
};

