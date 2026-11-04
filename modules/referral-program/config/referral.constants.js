import { customAlphabet } from "nanoid";

export const REFERRAL_CONSTANTS = {
  QUALIFIED_THRESHOLD: 3,
  REWARD_AMOUNT_USD: 10,
  REWARD_CURRENCY: "USD",
};

export const REFERRAL_STATUS = Object.freeze({
  IN_PROGRESS: "in_progress",
  QUALIFIED: "qualified",
  REJECTED: "rejected",
});

const generateDigits = customAlphabet("0123456789", 4);

/**
 * Generate a unique referral code format: SANITIZED_NAME + "_" + 4 DIGITS
 * Example: "DRAKE_4819"
 */
export const generateReferralCode = (artistName = "ARTIST") => {
  const sanitized =
    artistName
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 10) || "ARTIST";

  return `${sanitized}_${generateDigits()}`;
};
