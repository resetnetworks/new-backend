export const calculatePrice = ({ accessType, basePrice, albumOnly }) => {
  if (accessType === "purchase-only") {
    return albumOnly ? 0 : basePrice;
  }
  return 0;
};