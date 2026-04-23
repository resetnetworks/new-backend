import { User } from "../../../../models/User.js";

export const prepareSubscriptionInvoiceData = async (transaction) => {
  if (!transaction) {
    console.warn("⚠️ SubscriptionInvoiceData: Missing transaction");
    return null;
  }

  const user = await User.findById(transaction.userId).select("name email").lean()

  if (!user) {
    console.warn( `⚠️ SubscriptionInvoiceData: User not found for transaction ${transaction._id}`);
    return null;
  }

  return {
    invoiceNumber: transaction.invoiceNumber,
    transactionId: transaction._id.toString(),
    issueDate: new Date(),

    seller: {
      name: "Reset Music",
      address: `45 Malviya Nagar road
New Delhi, Delhi 110017
India`,
      email: "billing@musicreset.com",
    },

    customer: {
      name: user.name || "Valued Customer",
      email: user.email,
    },

    items: [
      {
        description: "Artist Subscription",
        quantity: 1,
        price: transaction.amount,
        total: transaction.amount,
      },
    ],
    subtotal: transaction.amount,
    currency: transaction.currency || "INR",
    taxBreakdown: [],
    total: transaction.amount,
    amountPaid: transaction.amount,
    balanceDue: 0,
  };
};