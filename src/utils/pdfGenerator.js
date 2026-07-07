const PDFDocument = require('pdfkit');

const BRAND_COLOR = '#1d4ed8';
const INK_COLOR = '#1f2937';
const MUTED_COLOR = '#6b7280';
const BORDER_COLOR = '#c7d2fe';

function formatDate(value) {
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// Renders the certificate directly to the HTTP response as a PDF — there is
// no stored file on disk (see the Phase 8 migration's reasoning for
// dropping `file_key`), so a certificate is always rendered fresh from its
// database row and is therefore always available for download regardless of
// when it was issued.
function streamCertificatePdf(res, certificate) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${certificate.certificate_number}.pdf"`
  );

  const doc = new PDFDocument({ layout: 'landscape', size: 'A4', margin: 0 });
  doc.pipe(res);

  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;

  // Decorative border.
  doc
    .rect(24, 24, pageWidth - 48, pageHeight - 48)
    .lineWidth(2)
    .stroke(BORDER_COLOR);
  doc
    .rect(34, 34, pageWidth - 68, pageHeight - 68)
    .lineWidth(1)
    .stroke(BORDER_COLOR);

  // Brand mark (vector circle + wordmark — no external logo asset needed).
  const brandCenterX = pageWidth / 2;
  doc.circle(brandCenterX, 78, 18).fill(BRAND_COLOR);
  doc
    .fillColor('#ffffff')
    .fontSize(16)
    .font('Helvetica-Bold')
    .text('CC', brandCenterX - 18, 69, {
      width: 36,
      align: 'center',
    });
  doc
    .fillColor(BRAND_COLOR)
    .fontSize(14)
    .font('Helvetica-Bold')
    .text('CommunityConnect', 0, 104, { width: pageWidth, align: 'center' });

  // Title.
  doc
    .fillColor(INK_COLOR)
    .fontSize(30)
    .font('Helvetica-Bold')
    .text('Certificate of Appreciation', 0, 140, { width: pageWidth, align: 'center' });

  doc
    .fillColor(MUTED_COLOR)
    .fontSize(13)
    .font('Helvetica')
    .text('This certificate is proudly presented to', 0, 188, {
      width: pageWidth,
      align: 'center',
    });

  doc
    .fillColor(BRAND_COLOR)
    .fontSize(26)
    .font('Helvetica-Bold')
    .text(certificate.volunteer_name, 0, 214, { width: pageWidth, align: 'center' });

  doc
    .fillColor(INK_COLOR)
    .fontSize(13)
    .font('Helvetica')
    .text(
      `in recognition of ${Number(certificate.total_hours).toFixed(2)} volunteer hours contributed at`,
      0,
      256,
      { width: pageWidth, align: 'center' }
    );

  doc
    .fillColor(INK_COLOR)
    .fontSize(18)
    .font('Helvetica-Bold')
    .text(certificate.event_title, 0, 278, { width: pageWidth, align: 'center' });

  doc
    .fillColor(MUTED_COLOR)
    .fontSize(12)
    .font('Helvetica')
    .text(`held on ${formatDate(certificate.event_start_datetime)}`, 0, 306, {
      width: pageWidth,
      align: 'center',
    });

  // Footer: certificate metadata (left) and signature block (right).
  const footerY = pageHeight - 140;
  const marginX = 80;

  doc
    .fillColor(INK_COLOR)
    .fontSize(10)
    .font('Helvetica-Bold')
    .text('Certificate ID', marginX, footerY)
    .font('Helvetica')
    .text(certificate.certificate_number, marginX, footerY + 14);

  doc
    .font('Helvetica-Bold')
    .text('Verification Code', marginX, footerY + 34)
    .font('Helvetica')
    .text(certificate.verification_code, marginX, footerY + 48);

  doc
    .font('Helvetica-Bold')
    .text('Issue Date', marginX, footerY + 68)
    .font('Helvetica')
    .text(formatDate(certificate.issued_at), marginX, footerY + 82);

  const signatureX = pageWidth - marginX - 200;
  doc
    .moveTo(signatureX, footerY + 70)
    .lineTo(signatureX + 200, footerY + 70)
    .lineWidth(1)
    .stroke(MUTED_COLOR);
  doc
    .fontSize(11)
    .font('Helvetica-Bold')
    .text('Authorized Signature', signatureX, footerY + 76, { width: 200, align: 'center' })
    .fontSize(9)
    .font('Helvetica')
    .fillColor(MUTED_COLOR)
    .text('CommunityConnect Administration', signatureX, footerY + 92, {
      width: 200,
      align: 'center',
    });

  doc.end();
}

// Generic tabular report PDF (Reports & Analytics export) — reused by all
// four reports rather than one renderer per report, since the shape is
// identical: a title, an optional subtitle (the active filters), and a
// paginated table. Landscape gives the widest report (Event Report, 9
// columns) more room per column than portrait would.
//
// Row height is measured per row via doc.heightOfString rather than a fixed
// constant — a fixed height silently overlapped rows whenever a cell's text
// wrapped to two lines in a narrow column (long event titles, "Attendance
// Rate (%)" as a header), which only shows up once real, non-trivial-length
// data is exported and rendered, not on a doc.text() call count.
function streamTablePdf(res, { filename, title, subtitle, columns, rows }) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
  doc.pipe(res);

  doc.fillColor(INK_COLOR).fontSize(18).font('Helvetica-Bold').text(title);
  if (subtitle) {
    doc.moveDown(0.2);
    doc.fillColor(MUTED_COLOR).fontSize(10).font('Helvetica').text(subtitle);
  }

  const startX = doc.page.margins.left;
  const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const colWidth = usableWidth / columns.length;
  const cellWidth = colWidth - 6;
  const bottomLimit = doc.page.height - doc.page.margins.bottom;
  const MIN_ROW_HEIGHT = 18;
  const CELL_PADDING = 8;

  function cellValues(row, isHeader) {
    return columns.map((col) => {
      if (isHeader) return col.label;
      const value = col.format ? col.format(row) : row[col.key];
      return value === null || value === undefined ? '' : String(value);
    });
  }

  function measureRowHeight(values) {
    let maxHeight = MIN_ROW_HEIGHT;
    values.forEach((text) => {
      const h = doc.heightOfString(text, { width: cellWidth });
      if (h > maxHeight) maxHeight = h;
    });
    return maxHeight + CELL_PADDING;
  }

  function drawRow(values, y, height, { header = false } = {}) {
    doc
      .font(header ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(9)
      .fillColor(INK_COLOR);
    values.forEach((text, i) => {
      doc.text(text, startX + i * colWidth, y, { width: cellWidth });
    });
    if (header) {
      doc
        .moveTo(startX, y + height)
        .lineTo(startX + usableWidth, y + height)
        .lineWidth(1)
        .stroke(BORDER_COLOR);
    }
  }

  const headerValues = cellValues(null, true);
  const headerHeight = measureRowHeight(headerValues);

  function drawHeader(y) {
    drawRow(headerValues, y, headerHeight, { header: true });
  }

  let y = doc.y + 12;
  drawHeader(y);
  y += headerHeight + 4;

  rows.forEach((row) => {
    const values = cellValues(row, false);
    const height = measureRowHeight(values);

    if (y + height > bottomLimit) {
      doc.addPage();
      y = doc.page.margins.top;
      drawHeader(y);
      y += headerHeight + 4;
    }

    drawRow(values, y, height);
    y += height;
  });

  if (rows.length === 0) {
    doc
      .fillColor(MUTED_COLOR)
      .fontSize(10)
      .font('Helvetica')
      .text('No data matches the current filters.', startX, y);
  }

  doc.end();
}

module.exports = { streamCertificatePdf, streamTablePdf };
