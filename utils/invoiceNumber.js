import { Counter } from "../models/Counter.js";
import logger  from "./logger.js";

export const getNextInvoiceNumber = async () => {
  try {
    const year = new Date().getFullYear();

    const counter = await Counter.findOneAndUpdate(
      {
        name: "invoice",
        year, // 🔥 add year-based separation
      },
      {
        $inc: { seq: 1 },
      },
      {
        new: true,
        upsert: true,
      }
    );

    const paddedSeq = String(counter.seq).padStart(6, "0");

    return `INV-${year}-${paddedSeq}`;

  } catch (err) {
    logger.error(
      { error: err.message, stack: err.stack },
      "Failed to generate invoice number"
    );

    throw new Error("Could not generate invoice number");
  }
};