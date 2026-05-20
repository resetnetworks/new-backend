// modules/email-services/templates/invoice/invoice.pdf.js

import fs from "fs/promises";
import path from "path";
import puppeteer from "puppeteer";
import { fromRoot } from "../../../../utils/paths.js";
import { formatMoney } from "../../utils/moneyFormatter.js";

const formatDate = (date) =>
  new Date(date)
    .toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
    .toUpperCase();

function buildItemsRows(invoice) {
  return invoice.items
    .map(
      (item) => `
      <tr style="border-bottom: 1px solid #ddd;">
        <td style="font-size:12px;padding:10px 6px 10px 0;">${invoice.itemNumber}</td>
        <td style="font-size:12px;font-weight:bold;padding:10px 6px;">${item.description}</td>
        <td style="font-size:12px;text-align:right;padding:10px 6px;">${item.quantity}</td>
        <td style="font-size:12px;text-align:right;padding:10px 6px;">
          ${formatMoney(item.price, invoice.currency)}
        </td>
        <td style="font-size:12px;text-align:right;padding:10px 6px;">
          ${formatMoney(item.total, invoice.currency)}
        </td>
        <td style="font-size:12px;text-align:right;padding:10px 6px;">0.00%</td>
        <td style="font-size:12px;text-align:right;padding:10px 6px;">0.00</td>
        <td style="font-size:12px;text-align:right;padding:10px 0 10px 6px;">
          ${formatMoney(item.total, invoice.currency)}
        </td>
      </tr>
    `
    )
    .join("");
}

function injectDataIntoTemplate(template, invoice, logoBase64) {
  const itemsRows = buildItemsRows(invoice);

  return template
    .replace(/{{invoiceNumber}}/g, invoice.invoiceNumber)
    .replace(/{{invoiceDate}}/g, formatDate(invoice.issueDate))
    .replace(/{{transactionId}}/g, invoice.transactionId)
    .replace(/{{customerEmail}}/g, invoice.customer.email)
    .replace(/{{customerName}}/g, invoice.customer.name)
    .replace(/{{currency}}/g, invoice.currency)
    .replace(/{{gatewayMethod}}/g, invoice.gateway?.charAt(0).toUpperCase() + invoice.gateway?.slice(1))
    .replace(/{{itemsRows}}/g, itemsRows)
    .replace(/{{netAmount}}/g, formatMoney(invoice.subtotal, invoice.currency))
    .replace(/{{taxAmount}}/g, formatMoney(invoice.tax, invoice.currency))
    .replace(/{{grandTotal}}/g, formatMoney(invoice.total, invoice.currency))

    .replace(/{{logoSrc}}/g, logoBase64);
}

export const generateInvoiceBuffer = async (invoice) => {
  try {
    // 1️⃣ load HTML template
    const templatePath = fromRoot(
      "modules",
      "email-services",
      "templates",
      "invoice",
      "invoice.template.html"
    );
    let html = await fs.readFile(templatePath, "utf8");

    // 2️⃣ load logo and convert to base64
    const logoPath = fromRoot("assets", "images", "resetIcon.png");
    const logoBuffer = await fs.readFile(logoPath);
    const logoBase64 = `data:image/png;base64,${logoBuffer.toString("base64")}`;

    // 3️⃣ inject dynamic data + logo
    html = injectDataIntoTemplate(html, invoice, logoBase64);

    // 4️⃣ launch headless browser
    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();

    // 5️⃣ set HTML content
    await page.setContent(html, { waitUntil: "networkidle0" });

    // 6️⃣ generate PDF buffer
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0px", bottom: "0px", left: "0px", right: "0px" },
    });

    await browser.close();

    return pdfBuffer;
  } catch (err) {
    console.error("Invoice PDF generation failed:", err);
    throw err;
  }
};