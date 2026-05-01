
export const formatMoney = (amount, currency, locale = "en-US") => {
  if (amount == null) return "";

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency.toUpperCase(), // ← fix
  }).format(amount);
};