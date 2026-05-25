// modules/coupon/coupon.errors.js

export class CouponError extends Error {
  constructor(message) {
    super(message);
    this.name = "CouponError";
    this.statusCode = 400;
  }
}

export class CouponExpiredError extends CouponError {}
export class CouponNotStartedError extends CouponError {}
export class CouponNotApplicableError extends CouponError {}
export class CouponUsageExceededError extends CouponError {}
export class CouponInvalidError extends CouponError {}