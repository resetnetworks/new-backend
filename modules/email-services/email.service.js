import { EmailProducer } from "./producer/email.producer.js";
import { EMAIL_JOBS } from "./producer/email.constants.js";

export const EmailService = {

  sendUserWelcome(payload) {
    return EmailProducer.addJob(
      EMAIL_JOBS.USER_WELCOME,
      { payload }
    );
  },
  
  sendPasswordReset(userId, resetToken) {
    return EmailProducer.addJob(
      EMAIL_JOBS.PASSWORD_RESET,
      { userId, resetToken }
    );
  },
  
  sendArtistApproved(payload) {
    return EmailProducer.addJob(
      EMAIL_JOBS.ARTIST_APPROVED,
      { payload }
    );
  },

  // Payments / Billing
  sendOneTimeInvoice(transactionId) {
    return EmailProducer.addJob(
      EMAIL_JOBS.INVOICE_ONE_TIME_PAYMENT,
      { transactionId }
    );
  },

  sendSubscriptionInvoice(transactionId) {
    return EmailProducer.addJob(
      EMAIL_JOBS.INVOICE_SUBSCRIPTION_STARTED,
      { transactionId }
    );
  },

  sendSubscriptionCancelled(payload) {
    return EmailProducer.addJob(
      EMAIL_JOBS.SUBSCRIPTION_CANCELLED,
      { payload }
    );
  },
};