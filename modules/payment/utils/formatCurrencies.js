const ZERO_DECIMAL_CURRENCIES = ["jpy", "krw", "huf", "vnd"];

export function formatAmount(amount, currency) {
  if (ZERO_DECIMAL_CURRENCIES.includes(currency)) {
    return Math.round(amount); // no decimals allowed
  }
  return Math.round(amount * 100); // 2 decimals max
}