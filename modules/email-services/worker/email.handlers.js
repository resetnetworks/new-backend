import { User } from "../../../models/User.js";
import { prepareRegistrationData, prepareRegistrationEmailFormat } from "../templates/registration.email.template.js";
import { preparePasswordResetData, preparePasswordResetEmailFormat } from "../templates/passwordReset.email.template.js";
import { sendMail } from "./email.mailer.service.js";
import { EMAIL_SENDERS } from "../utils/email.identify.js";

// ===================================================================
// 🔐 REGISTRATION EMAIL HANDLER
// ===================================================================
export const processAndSendRegistrationEmail = async ( payload ) => {
  const jobTag = "USER_WELCOME_EMAIL";

  try {
    console.log(`\n📨 [${jobTag}] Job started`);
    console.log(`🔎 [${jobTag}] Payload received:`, payload);

    // 1️⃣ Fetch user from DB
    // console.log(`🗄️ [${jobTag}] Fetching user from MongoDB → ID: ${payload.id}`);

    const user = await User.findById(payload.id)
      .select("name email username")
      .lean();

    if (!user) {
      console.warn(`⚠️ [${jobTag}] User not found in DB. Skipping email.`);
      return;
    }

    // 2️⃣ Prepare dynamic data for template

    const data = await prepareRegistrationData(user);

    if (!data) {
      console.warn(`⚠️ [${jobTag}] Failed to prepare email data. Aborting.`);
      return;
    }

    // 3️⃣ Build email template (subject + html + text)

    const emailContent = prepareRegistrationEmailFormat(data);

    if (!emailContent) {
      console.warn(`⚠️ [${jobTag}] Template generation failed. Aborting.`);
      return;
    }

    await sendMail(user.email, emailContent, EMAIL_SENDERS.INFO);

    console.log(`\n🎉 [${jobTag}] Email successfully sent → ${user.email} 🎉\n`);

  } catch (err) {
    console.error(`💥 [${jobTag}] Job failed:`, err);
    throw err; // important → allows BullMQ retries
  }
};


// ===================================================================
// 🔐 PASSWORD RESET EMAIL HANDLER
// ===================================================================
export const processAndSendPasswordResetEmail = async ({ userId, resetToken }) => {
  const jobTag = "PASSWORD_RESET_EMAIL";

  try {
    console.log(`\n📨 [${jobTag}] Job started`);
    console.log(`🔎 [${jobTag}] Payload received:`, { userId, resetToken });

    // 1️⃣ Fetch user from DB
    const user = await User.findById(userId)
      .select("name email")
      .lean();

    if (!user) {
      console.warn(`⚠️ [${jobTag}] User not found. Skipping email.`);
      return;
    }

    // 2️⃣ Prepare template data
    const data = await preparePasswordResetData(user, resetToken);

    if (!data) {
      console.warn(`⚠️ [${jobTag}] Failed to prepare email data. Aborting.`);
      return;
    }

    // 3️⃣ Build email content
    const emailContent = preparePasswordResetEmailFormat(data);

    if (!emailContent) {
      console.warn(`⚠️ [${jobTag}] Template generation failed. Aborting.`);
      return;
    }

    // 4️⃣ Send email
    await sendMail(user.email, emailContent, EMAIL_SENDERS.SUPPORT);

    console.log(`\n🎉 [${jobTag}] Email successfully sent → ${user.email} 🎉\n`);

  } catch (err) {
    console.error(`💥 [${jobTag}] Job failed:`, err);
    throw err; // IMPORTANT → enables BullMQ retries
  }
};


// ===================================================================
// 🔐 ONE TIME INVOICE EMAIL HANDLER
// ===================================================================

import { Transaction } from "../../../models/Transaction.js";
import { prepareInvoiceData, generateInvoiceBuffer, 
  prepareInvoiceEmailFormat, prepareSubscriptionInvoiceData 
} from "../templates/invoice/index.js"

export const processAndSendOneTimeInvoiceEmail = async ({ transactionId }) => {
  const jobTag = "ONE_TIME_INVOICE_EMAIL";

  try {
    console.log(`📄 [${jobTag}] Job started`);
    console.log(`🔎 [${jobTag}] TransactionId: ${transactionId}`);

    // 1️⃣ Fetch transaction from DB
    console.log(`📥 [${jobTag}] Fetching transaction from database...`);
    const transaction = await Transaction.findById(transactionId).lean();

    if (!transaction) {
      console.warn(`⚠️ [${jobTag}] Transaction not found. Exiting job.`);
      return;
    }

    // 2️⃣ Prepare invoice data
    console.log(`🧾 [${jobTag}] Preparing invoice data...`);
    const invoiceData = await prepareInvoiceData(transaction);

    if (!invoiceData) {
      console.warn(`⚠️ [${jobTag}] Invoice data preparation failed. Exiting job.`);
      return;
    }

    // 3️⃣ Generate PDF buffer
    console.log(`📄 [${jobTag}] Generating invoice PDF...`);
    const pdfBuffer = await generateInvoiceBuffer(invoiceData);

    // 4️⃣ Prepare email template/content
    console.log(`✉️ [${jobTag}] Preparing email content...`);
    const emailContent = prepareInvoiceEmailFormat(invoiceData);

    console.log(`✅ [${jobTag}] Email content ready`);

    // 5️⃣ Send email with PDF attachment
    console.log(`📤 [${jobTag}] Sending invoice email to ${invoiceData.customer.email}...`);
    await sendMail(invoiceData.customer.email, {
      ...emailContent,
      attachments: [
        {
          filename: `${invoiceData.invoiceNumber}.pdf`,
          content: pdfBuffer,
        },
      ],
    }, EMAIL_SENDERS.BILLING);

    console.log(`\n🎉 [${jobTag}] Invoice Email successfully sent -> ${invoiceData.customer.email} 🎉\n`);

  } catch (err) {
    console.error(`💥 [${jobTag}] Job failed with error:`);
    console.error(err);
    throw err;
  }
};

// ===================================================================
// 🔐 SUBSCRIPTION INVOICE EMAIL HANDLER
// ===================================================================

export const processAndSendSubscriptionInvoiceEmail = async ({ transactionId }) => {
  const jobTag = "SUBSCRIPTION_INVOICE_EMAIL";

  try {
    console.log(`📄 [${jobTag}] Job started`);
    console.log(`🔎 [${jobTag}] TransactionId: ${transactionId}`);

    // 1️⃣ fetch subscription
    console.log(`📥 [${jobTag}] Fetching transcation from database...`);
    const transaction = await Transaction.findById(transactionId).lean();
    // console.log("INSIDE transcation: ", transaction)
    if (!transaction) {
      console.warn(`⚠️ [${jobTag}] Subscription not found. Exiting job.`);
      return;
    }

    // 2️⃣ Prepare invoice data
    console.log(`🧾 [${jobTag}] Preparing subscription invoice data...`);
    // const invoiceData = await prepareSubscriptionInvoiceData(transaction);
    const invoiceData = await prepareInvoiceData(transaction);
    // console.log("INVOICE DATA:", invoiceData);

    if (!invoiceData) {
      console.warn(`⚠️ [${jobTag}] Invoice data preparation failed. Exiting job.`);
      return;
    }

    // 3️⃣ Generate PDF buffer
    console.log(`📄 [${jobTag}] Generating invoice PDF...`);
    const pdfBuffer = await generateInvoiceBuffer(invoiceData);

    // 4️⃣ Prepare email template/content
    console.log(`✉️ [${jobTag}] Preparing email content...`);
    const emailContent = prepareInvoiceEmailFormat(invoiceData);

    console.log(`✅ [${jobTag}] Email content ready`);

    // 5️⃣ Send email with PDF attachment
    console.log(`📤 [${jobTag}] Sending subscription invoice email to ${invoiceData.customer.email}...`);
    await sendMail(invoiceData.customer.email, {
      ...emailContent,
      attachments: [
        {
          filename: `${invoiceData.invoiceNumber}.pdf`,
          content: pdfBuffer,
        },
      ],
    }, EMAIL_SENDERS.BILLING);

    console.log(`\n🎉 [${jobTag}] Subscription Invoice Email successfully sent -> ${invoiceData.customer.email} 🎉\n`);

  } catch (err) {
    console.error(`💥 [${jobTag}] Job failed with error:`);
    console.error(err);
    throw err;
  }
};


// ===================================================================
// 🔕 SUBSCRIPTION CANCELLED EMAIL HANDLER
// ===================================================================

import { Artist } from "../../../models/Artist.js";
import { prepareSubscriptionCancelledEmailTemplate } from "../templates/subscription.cancelled.template.js";

export const processAndSendSubscriptionCancelledEmail = async ({ payload }) => {
  const jobTag = "SUBSCRIPTION_CANCELLED_EMAIL";

  try {
    console.log(`\n📨 [${jobTag}] Job started`);
    console.log(`🔎 [${jobTag}] Payload:`, payload);

    const { userId, artistId, validUntil } = payload;

    // 1️⃣ Fetch user
    const user = await User.findById(userId).select("name email").lean();

    if (!user) {
      console.warn(`⚠️ [${jobTag}] User not found. Skipping email.`);
      return;
    }

    // 2️⃣ Fetch artist
    const artist = await Artist.findById(artistId).select("name").lean();

    if (!artist) {
      console.warn(`⚠️ [${jobTag}] Artist not found. Skipping email.`);
      return;
    }

    // 3️⃣ Prepare email template
    const emailContent = prepareSubscriptionCancelledEmailTemplate({
      userName: user.name,
      artistName: artist.name,
      validUntil,
    });

    // 4️⃣ Send email
    await sendMail(user.email, emailContent, EMAIL_SENDERS.BILLING);

    console.log(`\n🎉 [${jobTag}] Cancellation Email successfully sent -> ${user.email} 🎉\n`);

  } catch (err) {
    console.error(`💥 [${jobTag}] Job failed:`, err);
    throw err;
  }
};


// ===================================================================
// 🎧 ARTIST APPROVED EMAIL HANDLER
// ===================================================================

import { prepareArtistApprovedData, prepareArtistApprovedEmailTemplate } from "../templates/artistApproved.email.template.js"

export const processAndSendArtistApprovedEmail = async ({ payload }) => {
  const jobTag = "ARTIST_APPROVED_EMAIL";

  // console.log("💥 💥 💥 💥");
  // console.log("this is from artist approval payload: ", payload)

  try {
    console.log(`\n📨 [${jobTag}] Job started`);
    console.log(`🔎 [${jobTag}] Payload received:`, payload);

    if (!payload?.userEmail) {
      console.warn(`⚠️ [${jobTag}] Missing email. Aborting job.`);
      return;
    }

    // 1️⃣ Prepare dynamic template data
    const data = await prepareArtistApprovedData(payload);

    if (!data) {
      console.warn(`⚠️ [${jobTag}] Failed to prepare email data.`);
      return;
    }

    // 2️⃣ Build email template
    const emailContent = prepareArtistApprovedEmailTemplate(data);

    // 2️⃣ Send email
    await sendMail(payload.userEmail, emailContent, EMAIL_SENDERS.ARTISTS);

    console.log(`\n🎉 [${jobTag}] Artist Approval Email successfully sent -> ${payload.userEmail} 🎉\n`);

  } catch (err) {
    console.error(`💥 [${jobTag}] Job failed:`, err);
    throw err; // allows BullMQ retries
  }
};