// modules/email-services/templates/invoice/invoice.pdf.js

import PDFDocument from "pdfkit";

const formatDate = (date) => new Date(date).toLocaleDateString("en-IN");

// 🔹 Generate invoice PDF buffer
export const generateInvoiceBuffer = (invoice) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const buffers = [];
      doc.on("data", buffers.push.bind(buffers));
      doc.on("end", () => resolve(Buffer.concat(buffers)));

      const startX = doc.page.margins.left;
      const endX = doc.page.width - doc.page.margins.right;

      // ------------------- Seller Info -------------------
      doc.fontSize(20).font("Helvetica-Bold").text(invoice.seller.name, startX, doc.y);
      doc.fontSize(10).font("Helvetica").text(invoice.seller.address);
      doc.text(invoice.seller.email || "");
      doc.text(invoice.seller.phone || "");
      doc.moveDown();

      // ------------------- Invoice Header -------------------
      doc.fontSize(14).font("Helvetica-Bold")
        .text("INVOICE", endX - 100, doc.y - 50, { width: 100, align: "right" });
      doc.fontSize(10).font("Helvetica")
        .text(`Invoice #${invoice.invoiceNumber}`, { align: "right" });
      doc.text(`Transaction ID: ${invoice.transactionId}`, { align: "right" });
      doc.text(`Issue Date: ${formatDate(invoice.issueDate)}`, { align: "right" });
      doc.moveDown(2);

      // ------------------- Separator -------------------
      doc.strokeColor("#aaaaaa").lineWidth(1)
        .moveTo(startX, doc.y).lineTo(endX, doc.y).stroke();
      doc.moveDown();

      // ------------------- Customer Info -------------------
      doc.fontSize(10).font("Helvetica-Bold").text("INVOICE TO:");
      doc.font("Helvetica").text(invoice.customer.name || "");
      doc.text(invoice.customer.email || "");
      doc.text(invoice.customer.phone || "");
      doc.moveDown(2);

      // ------------------- Table -------------------
      const descriptionX = startX,
        quantityX = 300,
        priceX = 380,
        totalX = 450;
      let tableY = doc.y;

      // Table Header
      doc.font("Helvetica-Bold").fontSize(10);
      doc.text("Product/Service", descriptionX, tableY);
      doc.text("Qty", quantityX, tableY, { width: 50, align: "right" });
      doc.text("Price", priceX, tableY, { width: 70, align: "right" });
      doc.text("Total", totalX, tableY, { width: 70, align: "right" });

      tableY += 20;
      doc.strokeColor("#cccccc").lineWidth(1)
        .moveTo(startX, tableY - 5).lineTo(endX, tableY - 5).stroke();

      // Table Rows
      doc.font("Helvetica").fontSize(10);
      invoice.items.forEach((item) => {
        const rowHeight = Math.max(
          doc.heightOfString(item.description, { width: quantityX - descriptionX - 10 }),
          doc.heightOfString(item.quantity.toString(), { width: 50 }),
          doc.heightOfString(item.price.toFixed(2), { width: 70 }),
          doc.heightOfString(item.total.toFixed(2), { width: 70 })
        ) + 5;

        doc.text(item.description, descriptionX, tableY, { width: quantityX - descriptionX - 10 });
        doc.text(item.quantity.toString(), quantityX, tableY, { width: 50, align: "right" });
        doc.text(item.price.toFixed(2), priceX, tableY, { width: 70, align: "right" });
        doc.text(item.total.toFixed(2), totalX, tableY, { width: 70, align: "right" });

        tableY += rowHeight;

        // optional row separator
        doc.strokeColor("#eeeeee").lineWidth(0.5)
          .moveTo(startX, tableY - 2).lineTo(endX, tableY - 2).stroke();
      });

      // ------------------- Totals -------------------
      doc.moveDown(1);
      const totalsX = endX - 150;
      doc.font("Helvetica-Bold").text("Subtotal:", totalsX, tableY, { width: 100, align: "right" });
      doc.font("Helvetica").text(`${invoice.currency} ${invoice.subtotal.toFixed(2)}`, endX - 100, tableY, { width: 100, align: "right" });

      tableY += 20;
      doc.font("Helvetica-Bold").text("Invoice Total:", totalsX, tableY, { width: 100, align: "right" });
      doc.font("Helvetica").text(`${invoice.currency} ${invoice.total.toFixed(2)}`, endX - 100, tableY, { width: 100, align: "right" });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};