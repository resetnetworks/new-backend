import { EMAIL_JOBS } from "../producer/email.constants.js";
import { 
  processAndSendRegistrationEmail, 
  processAndSendPasswordResetEmail, 
  processAndSendOneTimeInvoiceEmail,
  processAndSendSubscriptionInvoiceEmail,
  processAndSendSubscriptionCancelledEmail,
  processAndSendArtistApprovedEmail
 } from "./email.handlers.js";

let globalEmailCounter = 0;

export const handleEmailJob = async (job) => {
  globalEmailCounter++;
  console.log("=================== job ===================")
  switch (job.name) {

    case EMAIL_JOBS.USER_WELCOME:
      console.log(`\n👉 👉 👉 👉 You are in jobDispatcher : ${globalEmailCounter} 👈 👈 👈 👈`)
      console.log("Processing the sendRegisrationEmail");
      return processAndSendRegistrationEmail(job.data.payload);

    case EMAIL_JOBS.PASSWORD_RESET:
      console.log(`\n👉 👉 👉 👉 You are in jobDispatcher : ${globalEmailCounter} 👈 👈 👈 👈`)
      console.log("Processing the ProcessAndSendPasswordResetEmail");
      return processAndSendPasswordResetEmail(job.data);

    case EMAIL_JOBS.ARTIST_APPROVED:
      console.log(`\n👉 👉 👉 👉 You are in jobDispatcher : ${globalEmailCounter} 👈 👈 👈 👈`)
      console.log("Processing ARTIST_APPROVAL email")
      return processAndSendArtistApprovedEmail(job.data);

    case EMAIL_JOBS.INVOICE_ONE_TIME_PAYMENT:
      console.log(`\n👉 👉 👉 👉 You are in jobDispatcher : ${globalEmailCounter} 👈 👈 👈 👈`)
      console.log("Processing ONE_TIME_INVOICE email")
      return processAndSendOneTimeInvoiceEmail(job.data);

    case EMAIL_JOBS.INVOICE_SUBSCRIPTION_STARTED:
      console.log(`\n👉 👉 👉 👉 You are in jobDispatcher : ${globalEmailCounter} 👈 👈 👈 👈`)
      console.log("Processing SUBSCRIPTION_INVOICE email")
      return processAndSendSubscriptionInvoiceEmail(job.data);
      
    case EMAIL_JOBS.SUBSCRIPTION_CANCELLED:
      console.log(`\n👉 👉 👉 👉 You are in jobDispatcher : ${globalEmailCounter} 👈 👈 👈 👈`)
      console.log("\nProcessing CANCELLATION invoice email");
      return processAndSendSubscriptionCancelledEmail(job.data);

    default:
      throw new Error(`Unknown email job: ${job.name}`);
  }
};