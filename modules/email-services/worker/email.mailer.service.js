import { SendEmailCommand, SendRawEmailCommand } from "@aws-sdk/client-ses";
import nodemailer from "nodemailer";
import { sesClient } from "../config/ses.client.js";
import { EMAIL_SENDERS } from "../utils/email.identify.js";

export const sendMail = async (to, emailContent, sender) => {
  if (!to || !emailContent) {
    console.warn("Missing email recipient or content.");
    return;
  }

  const safeSender = sender || EMAIL_SENDERS.INFO;
  console.log("SAFE SNDER:", safeSender);
  // const fromEmail = `${safeSender.name} <${process.env.SES_FROM_EMAIL}>`;
  const fromEmail = `${safeSender.name} <${safeSender.email}>`;

  const hasAttachments = emailContent.attachments?.length > 0;

  console.log("📨 Sending email via SES →", to);

  // =====================================================
  // 1️⃣ NORMAL EMAIL (no attachments) → keep old flow
  // =====================================================
  if (!hasAttachments) {
    const command = new SendEmailCommand({
      Source: fromEmail,
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: emailContent.subject },
        Body: {
          Html: { Data: emailContent.html || emailContent.text },
          Text: { Data: emailContent.text || "Email from our service" },
        },
      },
    });
      
    // console.log("❌ ❌ MAILER is down, uncomment it. ❌ ❌")
    await sesClient.send(command);
    
    console.log("✅ SES email sent (no attachment)");
    return;
  }

  // =====================================================
  // 2️⃣ EMAIL WITH ATTACHMENTS → SES RAW via Nodemailer
  // =====================================================
  console.log("📎 Attachments detected → using RAW email");

  const transporter = nodemailer.createTransport({
    streamTransport: true,
    newline: "unix",
    buffer: true,
  });

  const mailOptions = {
    from: fromEmail,            // REQUIRED HEADER
    to: to,                     // REQUIRED HEADER
    subject: emailContent.subject, // REQUIRED HEADER
    html: emailContent.html,
    text: emailContent.text,
    attachments: emailContent.attachments, // { filename, content: Buffer }
  };

  const info = await transporter.sendMail(mailOptions);

  const rawCommand = new SendRawEmailCommand({
    RawMessage: { Data: info.message },
  });

  // console.log("❌ ❌ MAILER is down, uncomment it. ❌ ❌")
  await sesClient.send(rawCommand);

  console.log("✅ SES email sent WITH attachment");
};