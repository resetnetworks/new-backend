import nodemailer from "nodemailer";
import { EMAIL_SENDERS } from "../utils/email.identify.js";

export const sendMail = async (to, emailContent, sender) => {
  if (!to || !emailContent) {
    console.warn("Missing email recipient or content.");
    return;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  // ⭐ fallback sender (never crash jobs)
  const safeSender = sender || EMAIL_SENDERS.INFO;
  const fromEmail = `"${safeSender.name}" <${safeSender.email}>`;

  console.log("📨 Sending email to:", to);

  await transporter.sendMail({
    from: fromEmail,
    to,
    subject: emailContent.subject,
    text: emailContent.text,
    html: emailContent.html,
    attachments: emailContent.attachments || [],
  });

  console.log("✅ Email sent to:", to);
};