// modules/email-services/templates/invoice/invoice.email.template.js

import { formatMoney } from "../utils/moneyFormatter.js";

export const prepareInvoiceEmailFormat = (invoiceData) => {

  // console.log("===============================")
  // console.log("invoice data: ", invoiceData)
  // console.log("===============================")
  const { invoiceNumber, customer, total, currency } = invoiceData;
  const userName = customer?.name || "there";
  const formattedAmount = formatMoney(total, currency);

  const subject = `Your Reset Music receipt`;

  const text = `
Hi ${userName},

Thanks for your purchase. Your receipt is attached.

Amount paid: ${formattedAmount}
Reference: ${invoiceNumber}

If you need help, contact support@musicreset.com

— Team Reset Music
Billing questions: support@musicreset.com
`;

  const html = `
    <!DOCTYPE html>
    <html>
    <body style="margin:0;font-family:Arial,Helvetica,sans-serif;background:#eef2ff;">
    <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center">

    <table width="100%" style="
      background:
        radial-gradient(circle at center, rgba(59,130,246,0.25) 0%, transparent 55%),
        linear-gradient(120deg, #020617, #0B1A3A, #1E3A8A);
      height:120px;
    ">
    <tr>
      <td align="center" valign="middle">
        <table cellpadding="0" cellspacing="0">
          <tr>
            <td style="vertical-align:middle;padding-right:12px;">
              <img
                src="https://res.cloudinary.com/dix5swbsw/image/upload/v1776162368/My%20Brand/pwa-512x512_vvr3yt.png"
                alt="Reset Music"
                width="80"
                style="display:block;border:0;outline:none;text-decoration:none;"
              />
            </td>
          </tr>
        </table>
      </td>
    </tr>
    </table>

    <table width="620" style="background:white;border-radius:16px;margin-top:-40px;padding:50px;">
    <tr><td style="color:#0f172a;font-size:16px;line-height:1.8;">

    <p>Hi ${userName},</p>

    <h2 style="margin:0;font-size:28px;font-weight:700;color:#000000;">
    Your receipt from Reset Music
    </h2>

    <p>
    Your payment was successful. Your receipt is attached to this email.
    </p>

    <p><b>Amount paid:</b> ${formattedAmount}</p>
    <p><b>Reference ID:</b> ${invoiceNumber}</p>

    <p>Your payment was received successfully and no further action is required.</p>
  

    <p style="margin-top:40px;">— Team Reset Music</p>

    <p style="font-size:13px;color:#64748b;margin-top:25px;">
    Billing questions? Contact <b>support@musicreset.com</b>
    </p>
    </td></tr></table>
    </td></tr></table>
    </body>
    </html>
`;

  return { subject, text, html };
};