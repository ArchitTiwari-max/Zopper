const { jsPDF } = require("jspdf");
const autoTable = require("jspdf-autotable").default || require("jspdf-autotable");
const fs = require("fs");

try {
  const doc = new jsPDF();
  doc.text("Hello Node!", 10, 10);
  autoTable(doc, {
    head: [['Name', 'Email']],
    body: [['John', 'john@example.com']]
  });
  const buffer = Buffer.from(doc.output('arraybuffer'));
  fs.writeFileSync("scratch/test.pdf", buffer);
  console.log("PDF generation success!");
} catch (e) {
  console.error("PDF generation failed:", e);
}
