import { User } from "../../../../models/User.js";


const resolveItemDescription = (transaction) => {
  const type = transaction.itemType;

  switch (type) {
    case "artist-subscription":
      return "Artist Subscription";

    case "album":
      return "Album Purchase";

    case "song":
      return "Song Purchase";

    // future-proof fallback
    default:
      return `${type || "Digital"} Purchase`;
  }
};


export const prepareInvoiceData = async (transaction) => {
  if (!transaction) {
    console.error("❌ prepareInvoiceData: transaction missing");
    return null;
  }

  const user = await User.findById(transaction.userId).select("name email").lean();

  // console.log("🧾 🧾 🧾 🧾 🧾 🧾 🧾 🧾 🧾 🧾 🧾 🧾 🧾 🧾 ")
  // console.log("Invoice.data.js -  transaction:", transaction);
  // console.log("🧾 🧾 🧾 🧾 🧾 🧾 🧾 🧾 🧾 🧾 🧾 🧾 🧾 🧾 ")


  if (!user) {
    console.error(
      `❌ prepareInvoiceData: user not found for transaction ${transaction._id}`
    );
    return null;
  }
  
  const description = resolveItemDescription(transaction);

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
        description,
        // description:
        //   transaction.itemType === "subscription"
        //     ? `Artist Subscription`
        //     : `${transaction.itemType} purchase`,
        quantity: 1,
        price: transaction.amount,
        total: transaction.amount,
      },
    ],
    subtotal: transaction.amount,
    currency: transaction.currency || "INR",
    taxBreakdown: [], // extend later if GST/VAT
    total: transaction.amount,
    amountPaid: transaction.amount,
    balanceDue: 0,
  };
};