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
      address: `Sakala tn 7-2  
Kesklinna linnaosa  
Tallinn, Harju maakond 10141  
Estonia`,
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