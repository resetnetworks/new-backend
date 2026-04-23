// modules/email-services/templates/invoice/invoice.pdf.js

import PDFDocument from "pdfkit";
import { formatMoney } from "../../utils/moneyFormatter.js";
import { fromRoot } from "../../../../utils/paths.js";

const formatDate = (date) => new Date(date).toLocaleDateString("en-IN");

export const generateInvoiceBuffer = (invoice) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 0 });
      const buffers = [];
      doc.on("data", buffers.push.bind(buffers));
      doc.on("end", () => resolve(Buffer.concat(buffers)));

      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;

      /* ───────── PAGE LIGHT BACKGROUND ───────── */
      doc.rect(0, 0, pageWidth, pageHeight).fill("#EEF2FF");

      /* ───────── HERO HEADER ───────── */
      doc.rect(0, 0, pageWidth, 140).fill("#0F172A")

      // using relative path here, ⚠️ CAUTION on folder change ⚠️ 
      const logoPath = fromRoot("assets", "images", "resetIcon.png");

      const headerHeight = 140;
      const logoSize = 70;

      doc.image(
        logoPath,
        pageWidth / 2 - logoSize / 2,
        headerHeight / 2 - logoSize / 2,
        { width: logoSize }
      );

      /* ───────── WHITE INVOICE CARD ───────── */
      const paddingX = 40;
      const startX = paddingX;
      const endX = pageWidth - paddingX;

      let y = headerHeight + 40;

      /* ───────── COMPANY INFO ───────── */
      doc.fillColor("#0F172A")
        .font("Helvetica-Bold")
        .fontSize(18)
        .text(invoice.seller.name, startX, y);

      y += 25;
      doc.font("Helvetica").fontSize(10)
        .text(invoice.seller.address)
        .text(invoice.seller.email);

      /* ───────── INVOICE META RIGHT ───────── */
      const metaX = endX - 160;
      let metaY = headerHeight + 40;

      doc.font("Helvetica-Bold")
        .fontSize(20)
        .fillColor("#1E3A8A")
        .text("INVOICE", metaX, metaY);

      metaY += 30;

      doc.font("Helvetica")
        .fontSize(10)
        .fillColor("#0F172A")
        .text(`Invoice #: ${invoice.invoiceNumber}`, metaX, metaY);

      metaY += 15;
      doc.text(`Transaction: ${invoice.transactionId}`, metaX, metaY);

      metaY += 15;
      doc.text(`Date: ${formatDate(invoice.issueDate)}`, metaX, metaY);

      /* ───────── BILL TO ───────── */
      y += 80;
      doc.font("Helvetica-Bold").fillColor("#64748B").text("BILL TO", startX, y);

      y += 18;
      doc.fillColor("#0F172A").fontSize(11)
        .text(invoice.customer.name)
        .font("Helvetica")
        .text(invoice.customer.email);

      /* ───────── TABLE ───────── */
      y += 60;

      doc.strokeColor("#E5E7EB")
        .moveTo(startX, y)
        .lineTo(endX, y)
        .stroke();

      y += 15;
      doc.font("Helvetica-Bold").fontSize(10);
      doc.text("Description", startX, y);
      doc.text("Qty", endX - 180, y);
      doc.text("Price", endX - 120, y);
      doc.text("Total", endX - 60, y);

      y += 20;
      doc.strokeColor("#E5E7EB")
        .moveTo(startX, y)
        .lineTo(endX, y)
        .stroke();

      y += 10;
      doc.font("Helvetica");

      invoice.items.forEach((item) => {
        doc.text(item.description, startX, y);
        doc.text(item.quantity.toString(), endX - 175, y);
        doc.text(formatMoney(item.price, invoice.currency), endX - 120, y);
        doc.text(formatMoney(item.total, invoice.currency), endX - 60, y);
        y += 25;
      });

      /* ───────── DIVIDER ───────── */
      doc.strokeColor("#E5E7EB")
        .moveTo(endX - 120, y)
        .lineTo(endX, y)
        .stroke();

      y += 10;

      /* ───────── TOTAL ───────── */
      y += 15;
      doc.font("Helvetica")
        .fontSize(11)
        .fillColor("black")
        .text("Total", endX - 120, y);

      doc.font("Helvetica-Bold")
        .fontSize(11)
        .fillColor("#1E3A8A")
        .text(formatMoney(invoice.total, invoice.currency), endX - 60, y);

      /* ───────── FOOTER ───────── */
      doc.fillColor("#64748B")
        .fontSize(9)
        .text(
          "Thank you for supporting independent artists.",
          startX,
          pageHeight - 40,
          { width: pageWidth - 80, align: "center" }
        );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};