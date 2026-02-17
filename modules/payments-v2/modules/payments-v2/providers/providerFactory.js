import { RazorpayAdapter } from "./razorpay.adapter.js";
// import { StripeAdapter } from "./stripe.adapter.js";
// import { PaypalAdapter } from "./paypal.adapter.js";

export function getProviderAdapter(provider) {
  switch (provider) {
    case "razorpay":
      return new RazorpayAdapter();

    // case "stripe":
    //   return new StripeAdapter();

    // case "paypal":
    //   return new PaypalAdapter();

    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }
}
