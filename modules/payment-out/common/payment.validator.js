export const validatePaymentMetadata = (metadata) => {
  if (!metadata || typeof metadata !== "object") {
    return { isValid: false, error: "Metadata missing or invalid" };
  }

  const { userId, itemId, itemType, couponId } = metadata;

  if (!userId) {
    return { isValid: false, error: "Missing userId" };
  }

  if (!itemId) {
    return { isValid: false, error: "Missing itemId" };
  }

  if (!itemType) {
    return { isValid: false, error: "Missing itemType" };
  }

  const allowedTypes = ["song", "album", "artist-subscription"];

  if (!allowedTypes.includes(itemType)) {
    return {
      isValid: false,
      error: `Invalid itemType: ${itemType}`,
    };
  }

  return {
    isValid: true,
    data: {
      userId,
      itemId,
      itemType,
      couponId: couponId || null,
    },
  };
};