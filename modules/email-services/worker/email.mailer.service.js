import nodemailer from "nodemailer";

// 🔹 Send Registration Email
export const sendMail = async (to, emailContent) => {
  if (!to || !emailContent) {
    console.warn("Missing email recipient or content. Skipping registration email.");
    return;
  }

  const transporter = nodemailer.createTransport({
    service: "gmail", // later switch to SES/SMTP in production
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  console.log("\n📨 📨 📨 📨Sending registration email to:", to);
  
  await transporter.sendMail({
    from: `"Reset Music" <${process.env.SMTP_USER}>`,
    to,
    subject: emailContent.subject,
    text: emailContent.text,
    html: emailContent.html,
    attachments: emailContent.attachments || [],
  });

  console.log("📥 📥 📥 📥 Registration email sent to:", to);
};