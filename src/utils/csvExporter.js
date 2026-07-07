// CSV export for the Reports module. Hand-rolled RFC 4180 escaping rather
// than a dependency (json2csv/csv-writer) — the app's own convention
// throughout has been to write small, direct logic instead of pulling in a
// package for something this size (the same reasoning `pdfGenerator.js`
// uses pdfkit only where real PDF layout is involved, not for this).
function escapeCsvField(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsv(columns, rows) {
  const header = columns.map((col) => escapeCsvField(col.label)).join(',');
  const lines = rows.map((row) =>
    columns.map((col) => escapeCsvField(col.format ? col.format(row) : row[col.key])).join(',')
  );
  return [header, ...lines].join('\r\n');
}

function sendCsv(res, filename, columns, rows) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(toCsv(columns, rows));
}

module.exports = { toCsv, sendCsv };
