import { EmailProducer } from "./producer/email.producer.js";
import { EMAIL_JOBS } from "./producer/email.constants.js";

import { createEmailJob } from "./services/emailTracking.service.js";

//==============================================================
// 🧠 EMAIL JOB PRE-PROCESSOR
// Creates tracking job + injects jobId into payload
// Eliminates duplicate service methods
//==============================================================

export const sendEmailJob = async ({ jobType, subject, userId, toEmail, payload, }) => {
  const job = await createEmailJob({
    userId,
    toEmail,
    template: jobType,
    subject,
    metadata: payload,
  });

  return { ...payload, jobId: job._id };
};


export const EmailService = {

  async sendUserWelcome(payload) {

    const enrichedPayload = await sendEmailJob({
      jobType: EMAIL_JOBS.USER_WELCOME,
      subject: "Welcome Email",
      userId: payload.userId,
      toEmail: payload.email,
      payload,
    });

    console.log("✅ ✅ ✅ ✅ ENRICHED PAYLOAD:", enrichedPayload);
    
    return EmailProducer.addJob(
      EMAIL_JOBS.USER_WELCOME,
      enrichedPayload
    );
  },
  
  async sendPasswordReset(payload) {
    const enrichedPayload = await sendEmailJob({
      jobType: EMAIL_JOBS.PASSWORD_RESET,
      subject: "Password Reset",
      userId: payload.userId,
      toEmail: payload.userEmail,
      payload,
    });
    
    console.log("✅ ✅ ✅ ✅ ENRICHED PAYLOAD:", enrichedPayload);
    return EmailProducer.addJob(
      EMAIL_JOBS.PASSWORD_RESET,
      enrichedPayload
    );
  },
  
  async sendArtistApproved(payload) {
    const enrichedPayload = await sendEmailJob({
      jobType: EMAIL_JOBS.ARTIST_APPROVED,
      subject: "Artist Approved",
      userId: payload.userId,
      toEmail: payload.userEmail,
      payload,
    });
    
    console.log("✅ ✅ ✅ ✅ ENRICHED PAYLOAD:", enrichedPayload);
    return EmailProducer.addJob(
      EMAIL_JOBS.ARTIST_APPROVED,
      enrichedPayload
    );
  },
  
  // Payments / Billing
  async sendOneTimeInvoice(payload) {
    const enrichedPayload = await sendEmailJob({
      jobType: EMAIL_JOBS.INVOICE_ONE_TIME_PAYMENT,
      subject: "Payment Invoice",
      userId: payload.userId,
      toEmail: payload.userEmail,
      payload,
    });
    
    console.log("✅ ✅ ✅ ✅ ENRICHED PAYLOAD:", enrichedPayload);
    return EmailProducer.addJob(
      EMAIL_JOBS.INVOICE_ONE_TIME_PAYMENT,
      enrichedPayload
    );
  },
  
  async sendSubscriptionInvoice(payload) {
    const enrichedPayload = await sendEmailJob({
      jobType: EMAIL_JOBS.INVOICE_SUBSCRIPTION_STARTED,
      subject: "Subscription Started",
      userId: payload.userId,
      toEmail: payload.userEmail,
      payload,
    });
    
    console.log("✅ ✅ ✅ ✅ ENRICHED PAYLOAD:", enrichedPayload);
    return EmailProducer.addJob(
      EMAIL_JOBS.INVOICE_SUBSCRIPTION_STARTED,
      enrichedPayload
    );
  },
  
  async sendSubscriptionCancelled(payload) {
    const enrichedPayload = await sendEmailJob({
      jobType: EMAIL_JOBS.SUBSCRIPTION_CANCELLED,
      subject: "Subscription Cancelled",
      userId: payload.userId,
      toEmail: payload.userEmail,
      payload,
    });
    
    console.log("✅ ✅ ✅ ✅ ENRICHED PAYLOAD:", enrichedPayload);
    return EmailProducer.addJob(
      EMAIL_JOBS.SUBSCRIPTION_CANCELLED,
      enrichedPayload
    );
  },
};