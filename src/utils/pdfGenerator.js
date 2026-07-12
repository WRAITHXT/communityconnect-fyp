const path = require('path');
const PDFDocument = require('pdfkit');
const { formatCurrency } = require('./format');

const BRAND_COLOR = '#1d4ed8';
const INK_COLOR = '#1f2937';
const MUTED_COLOR = '#6b7280';
const BORDER_COLOR = '#c7d2fe';
const HEADER_FILL = '#eef2ff';
const ZEBRA_FILL = '#f8fafc';

// Handwritten-style "CommunityConnect" mark rendered above the signature
// line, in place of any individual's real signature.
const SIGNATURE_IMAGE_PATH = path.join(
  __dirname,
  '../public/images/communityconnect-signature.png'
);

function formatDate(value) {
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatDateTime(value) {
  return new Date(value).toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// Turns a raw enum code (e.g. "medical_supplies") into display text
// ("Medical Supplies") for report tables/PDF only — the CSV export and the
// database keep the raw code, since only the PDF's table-cell renderer below
// ever calls this (see the `enumColumns` option on streamTablePdf).
function humanizeEnum(value) {
  if (value === null || value === undefined || value === '') return '';
  return String(value)
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
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
  const signatureBoxWidth = 200;

  // Handwritten-style mark, scaled proportionally from its natural size and
  // centered above the line — sits in the same blank vertical band the left
  // column uses for Certificate ID/Verification Code/Issue Date, so no
  // other footer element needs to move.
  const signatureImage = doc.openImage(SIGNATURE_IMAGE_PATH);
  const signatureImageWidth = 150;
  const signatureImageHeight = signatureImageWidth * (signatureImage.height / signatureImage.width);
  doc.image(
    SIGNATURE_IMAGE_PATH,
    signatureX + (signatureBoxWidth - signatureImageWidth) / 2,
    footerY + 64 - signatureImageHeight,
    { width: signatureImageWidth, height: signatureImageHeight }
  );

  doc
    .moveTo(signatureX, footerY + 70)
    .lineTo(signatureX + signatureBoxWidth, footerY + 70)
    .lineWidth(1)
    .stroke(MUTED_COLOR);
  doc
    .fontSize(11)
    .font('Helvetica-Bold')
    .text('Authorized Signature', signatureX, footerY + 76, {
      width: signatureBoxWidth,
      align: 'center',
    })
    .fontSize(9)
    .font('Helvetica')
    .fillColor(MUTED_COLOR)
    .text('CommunityConnect Administration', signatureX, footerY + 92, {
      width: signatureBoxWidth,
      align: 'center',
    });

  doc.end();
}

// Small brand lockup (circle + "CC" + wordmark) used at the top of every
// report page — same vector treatment as the certificate's brand mark
// (no external logo asset), just sized for a compact letterhead row
// instead of a centered certificate header.
function drawBrandRow(doc, marginX, y) {
  doc.circle(marginX + 9, y + 9, 9).fill(BRAND_COLOR);
  doc
    .fillColor('#ffffff')
    .fontSize(8)
    .font('Helvetica-Bold')
    .text('CC', marginX, y + 4, { width: 18, align: 'center' });
  doc
    .fillColor(BRAND_COLOR)
    .fontSize(12)
    .font('Helvetica-Bold')
    .text('CommunityConnect', marginX + 24, y + 3);
}

// Full letterhead + report metadata block, drawn once at the top of page 1
// only — brand row, report title, generated/period/generated-by lines, and
// an optional summary box. Returns the y-coordinate the table should start
// at, so the amount of space this block actually uses (summary present or
// not, one filter line or several) never has to be hardcoded at the call
// site.
function drawReportHeader(doc, { pageWidth, marginX, title, subtitle, generatedByLine, summary }) {
  let y = 24;
  drawBrandRow(doc, marginX, y);
  y += 30;

  doc
    .moveTo(marginX, y)
    .lineTo(pageWidth - marginX, y)
    .lineWidth(1)
    .stroke(BORDER_COLOR);
  y += 10;

  doc.fillColor(INK_COLOR).fontSize(17).font('Helvetica-Bold').text(title, marginX, y);
  y += 22;

  doc
    .fillColor(MUTED_COLOR)
    .fontSize(9)
    .font('Helvetica')
    .text(`Generated: ${formatDateTime(new Date())}    |    ${generatedByLine}`, marginX, y);
  y += 13;

  doc
    .fillColor(MUTED_COLOR)
    .fontSize(9)
    .font('Helvetica')
    .text(`Report Period: ${subtitle}`, marginX, y, { width: pageWidth - marginX * 2 });
  y += 18;

  if (summary && summary.length > 0) {
    const boxHeight = 46;
    doc
      .rect(marginX, y, pageWidth - marginX * 2, boxHeight)
      .fill(HEADER_FILL)
      .rect(marginX, y, pageWidth - marginX * 2, boxHeight)
      .lineWidth(1)
      .stroke(BORDER_COLOR);

    doc
      .fillColor(BRAND_COLOR)
      .fontSize(9)
      .font('Helvetica-Bold')
      .text('REPORT SUMMARY', marginX + 12, y + 8);

    const itemWidth = (pageWidth - marginX * 2 - 24) / summary.length;
    summary.forEach((item, i) => {
      const itemX = marginX + 12 + i * itemWidth;
      doc
        .fillColor(MUTED_COLOR)
        .fontSize(8)
        .font('Helvetica')
        .text(item.label, itemX, y + 24, { width: itemWidth - 8 });
      doc
        .fillColor(INK_COLOR)
        .fontSize(11)
        .font('Helvetica-Bold')
        .text(item.value, itemX, y + 34, { width: itemWidth - 8 });
    });

    y += boxHeight + 12;
  } else {
    y += 8;
  }

  doc
    .moveTo(marginX, y)
    .lineTo(pageWidth - marginX, y)
    .lineWidth(1)
    .stroke(BORDER_COLOR);
  y += 10;

  return y;
}

// Slim running header repeated on continuation pages (page 2+) — just
// enough brand context to identify the document without repeating the full
// metadata block and eating into table space on every page.
function drawContinuationHeader(doc, { pageWidth, marginX, title }) {
  let y = 20;
  drawBrandRow(doc, marginX, y);
  doc
    .fillColor(MUTED_COLOR)
    .fontSize(9)
    .font('Helvetica')
    .text(title, marginX, y + 3, { width: pageWidth - marginX * 2, align: 'right' });
  y += 26;
  doc
    .moveTo(marginX, y)
    .lineTo(pageWidth - marginX, y)
    .lineWidth(1)
    .stroke(BORDER_COLOR);
  return y + 10;
}

// Stamped on every page after the full document is laid out (see
// bufferPages below) — only at that point is the total page count known.
function drawFooters(doc, { pageWidth, pageHeight, marginX }) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const footerY = pageHeight - 34;
    doc
      .moveTo(marginX, footerY)
      .lineTo(pageWidth - marginX, footerY)
      .lineWidth(1)
      .stroke(BORDER_COLOR);
    // height: 20 — this text sits inside the page's own bottom margin
    // (deliberately: that space was reserved for it). pdfkit's text()
    // computes its overflow boundary as page.maxY() = page.height -
    // page.margins.bottom *unless* an explicit `height` is given, in which
    // case the boundary becomes startY + height instead. Without this,
    // every footer draw here (below page.maxY() by construction) reads as
    // overflow and silently starts a new page mid-footer — which is exactly
    // what left every export with extra blank trailing pages.
    doc
      .fillColor(MUTED_COLOR)
      .fontSize(8)
      .font('Helvetica')
      .text('Generated by CommunityConnect', marginX, footerY + 8, { height: 20 });
    doc
      .fillColor(MUTED_COLOR)
      .fontSize(8)
      .font('Helvetica')
      .text(`Page ${i - range.start + 1} of ${range.count}`, marginX, footerY + 8, {
        width: pageWidth - marginX * 2,
        align: 'right',
        height: 20,
      });
  }
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
//
// `enumColumns`/`currencyColumns` and `summary` are presentation-only
// additions for the PDF specifically — they never touch `columns`/`rows`
// themselves (the CSV export consumes those completely unchanged), they
// just tell this renderer which cells to display differently and what to
// put in the summary band above the table.
function streamTablePdf(
  res,
  {
    filename,
    title,
    subtitle,
    columns,
    rows,
    summary = [],
    currencyColumns = [],
    enumColumns = [],
    generatedBy,
  }
) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  const doc = new PDFDocument({
    size: 'A4',
    layout: 'landscape',
    bufferPages: true,
    margins: { top: 40, bottom: 55, left: 40, right: 40 },
  });
  doc.pipe(res);

  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const marginX = doc.page.margins.left;
  const bottomLimit = pageHeight - doc.page.margins.bottom;

  const generatedByLine = `Generated By: ${generatedBy || 'Administrator'} (Administrator)`;

  const startX = marginX;
  const usableWidth = pageWidth - marginX * 2;
  const colWidth = usableWidth / columns.length;
  const cellWidth = colWidth - 10;
  const MIN_ROW_HEIGHT = 16;
  const CELL_PADDING_Y = 8;
  const CELL_PADDING_X = 5;

  function resolveValue(row, col) {
    if (currencyColumns.includes(col.key)) {
      const raw = row[col.key];
      return raw === null || raw === undefined || raw === '' ? '' : formatCurrency(raw);
    }
    const value = col.format ? col.format(row) : row[col.key];
    if (enumColumns.includes(col.key)) return humanizeEnum(value);
    return value === null || value === undefined ? '' : String(value);
  }

  function cellValues(row, isHeader) {
    return columns.map((col) => (isHeader ? col.label : resolveValue(row, col)));
  }

  // A column is right-aligned in the PDF when every value it actually holds
  // (across all rows being rendered) looks like a number/currency amount —
  // computed from the data itself so numeric columns line up like a ledger
  // without any of the 4 reports needing to declare it column-by-column.
  const NUMERIC_PATTERN = /^(RM\s)?-?[\d,]+(\.\d+)?%?$/;
  const columnAligns = columns.map((col) => {
    const values = rows.map((row) => resolveValue(row, col)).filter((v) => v !== '');
    const numeric = values.length > 0 && values.every((v) => NUMERIC_PATTERN.test(v));
    return numeric ? 'right' : 'left';
  });

  function measureRowHeight(values) {
    let maxHeight = MIN_ROW_HEIGHT;
    values.forEach((text) => {
      const h = doc.heightOfString(text, { width: cellWidth });
      if (h > maxHeight) maxHeight = h;
    });
    return maxHeight + CELL_PADDING_Y;
  }

  function drawRow(values, y, height, { header = false, zebra = false } = {}) {
    if (header) {
      doc.rect(startX, y, usableWidth, height).fill(HEADER_FILL);
    } else if (zebra) {
      doc.rect(startX, y, usableWidth, height).fill(ZEBRA_FILL);
    }
    doc
      .font(header ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(9)
      .fillColor(header ? BRAND_COLOR : INK_COLOR);
    values.forEach((text, i) => {
      doc.text(text, startX + i * colWidth + CELL_PADDING_X, y + CELL_PADDING_Y / 2, {
        width: cellWidth,
        align: header ? columnAligns[i] : columnAligns[i],
      });
    });
    if (header) {
      doc
        .moveTo(startX, y + height)
        .lineTo(startX + usableWidth, y + height)
        .lineWidth(1)
        .stroke(BRAND_COLOR);
    }
  }

  const headerValues = cellValues(null, true);
  const headerHeight = measureRowHeight(headerValues);

  function drawHeader(y) {
    drawRow(headerValues, y, headerHeight, { header: true });
  }

  let y = drawReportHeader(doc, {
    pageWidth,
    marginX,
    title,
    subtitle,
    generatedByLine,
    summary,
  });

  drawHeader(y);
  y += headerHeight + 2;

  rows.forEach((row, index) => {
    const values = cellValues(row, false);
    const height = measureRowHeight(values);

    if (y + height > bottomLimit) {
      doc.addPage();
      y = drawContinuationHeader(doc, { pageWidth, marginX, title });
      drawHeader(y);
      y += headerHeight + 2;
    }

    drawRow(values, y, height, { zebra: index % 2 === 1 });
    y += height;
  });

  if (rows.length === 0) {
    doc
      .fillColor(MUTED_COLOR)
      .fontSize(10)
      .font('Helvetica')
      .text('No data matches the current filters.', startX, y + 10);
  }

  drawFooters(doc, { pageWidth, pageHeight, marginX });

  doc.end();
}

module.exports = { streamCertificatePdf, streamTablePdf };
