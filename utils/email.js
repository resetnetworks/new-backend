import nodemailer from "nodemailer";

export const sendInvoiceEmail = async (to, invoiceData) => {
  const port = Number(process.env.SMTP_PORT) || 587;
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.hostinger.com",
    port,
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const mailOptions = {
    from: `"MyApp" <${process.env.EMAIL_USER}>`,
    to,
    subject: "Your Subscription Invoice",
    html: `
      <h2>Thanks for your payment 🎉</h2>
      <p>Invoice ID: <b>${invoiceData.id}</b></p>
      <p>Amount: ₹${invoiceData.amount_paid / 100}</p>
      <p>Status: ${invoiceData.status}</p>
      <p>Date: ${new Date(invoiceData.created_at * 1000).toLocaleString()}</p>
    `,
  };

  await transporter.sendMail(mailOptions);
};
