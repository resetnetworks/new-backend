import { createSubscription } from "../services/subscription.service.js";
import logger from "../../../utils/logger.js";

export const createRazorpaySubscription = async (req, res) => {
  try {
    const result = await createSubscription({
      gateway: "razorpay",
      user: req.user,
      artistId: req.params.artistId,
      cycle: req.body.cycle,
    });

    return res.status(201).json(result);

  } catch (error) {
    logger.error(
      { error: error.message },
      "Create subscription controller failed"
    );

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};