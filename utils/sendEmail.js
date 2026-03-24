import nodemailer from "nodemailer";

export const sendEmail = async ({ to, subject, html }) => {
  const transporter = nodemailer.createTransport({
    service: "gmail", // or your provider
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    }
  });

  await transporter.sendMail({
    from: `"Music Platform" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html
  });
};