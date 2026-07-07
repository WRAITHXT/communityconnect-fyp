const reportService = require('../../services/reportService');
const donationService = require('../../services/donationService');
const csvExporter = require('../../utils/csvExporter');
const pdfGenerator = require('../../utils/pdfGenerator');
const { getAppShellLocals } = require('../../utils/viewHelpers');

const BREADCRUMB_ROOT = [
  { label: 'Dashboard', href: '/admin/dashboard' },
  { label: 'Reports', href: '/admin/reports' },
];

// Turns the parsed filter object back into a short human-readable line for
// the PDF export's subtitle — presentation-only formatting, not a business
// rule, so it stays in the controller rather than the service.
const FILTER_LABELS = {
  dateFrom: 'From',
  dateTo: 'To',
  eventId: 'Event',
  userId: 'Volunteer',
  donationType: 'Type',
  status: 'Status',
};

function describeFilters(filters) {
  const parts = Object.entries(filters)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${FILTER_LABELS[key] || key}: ${value}`);
  return parts.length > 0 ? parts.join(' | ') : 'All records';
}

async function overview(req, res, next) {
  try {
    const { stats, charts } = await reportService.getAnalyticsOverview();
    // Enrich with human labels here (a presentation concern) rather than in
    // reportService, so the service keeps returning raw donation_type codes.
    const donationsByType = charts.donationsByType.map((row) => ({
      ...row,
      label: donationService.DONATION_TYPE_LABELS[row.donation_type] || row.donation_type,
    }));

    res.render('pages/reports/overview', {
      title: 'Reports & Analytics - CommunityConnect',
      layout: 'layouts/app',
      ...getAppShellLocals(req),
      breadcrumbs: [{ label: 'Dashboard', href: '/admin/dashboard' }, { label: 'Reports' }],
      stats,
      charts: { ...charts, donationsByType },
      chartsJson: JSON.stringify({ ...charts, donationsByType }).replace(/</g, '\\u003c'),
    });
  } catch (err) {
    next(err);
  }
}

async function eventReport(req, res, next) {
  try {
    const report = await reportService.getEventReport(req.query);
    res.render('pages/reports/events', {
      title: 'Event Report - CommunityConnect',
      layout: 'layouts/app',
      ...getAppShellLocals(req),
      breadcrumbs: [...BREADCRUMB_ROOT, { label: 'Event Report' }],
      ...report,
    });
  } catch (err) {
    next(err);
  }
}

async function volunteerReport(req, res, next) {
  try {
    const report = await reportService.getVolunteerReport(req.query);
    res.render('pages/reports/volunteers', {
      title: 'Volunteer Report - CommunityConnect',
      layout: 'layouts/app',
      ...getAppShellLocals(req),
      breadcrumbs: [...BREADCRUMB_ROOT, { label: 'Volunteer Report' }],
      ...report,
    });
  } catch (err) {
    next(err);
  }
}

async function donationReport(req, res, next) {
  try {
    const report = await reportService.getDonationReport(req.query);
    res.render('pages/reports/donations', {
      title: 'Donation Report - CommunityConnect',
      layout: 'layouts/app',
      ...getAppShellLocals(req),
      breadcrumbs: [...BREADCRUMB_ROOT, { label: 'Donation Report' }],
      ...report,
      donationTypes: reportService.DONATION_TYPES,
      donationStatuses: reportService.DONATION_STATUSES,
    });
  } catch (err) {
    next(err);
  }
}

async function certificateReport(req, res, next) {
  try {
    const report = await reportService.getCertificateReport(req.query);
    res.render('pages/reports/certificates', {
      title: 'Certificate Report - CommunityConnect',
      layout: 'layouts/app',
      ...getAppShellLocals(req),
      breadcrumbs: [...BREADCRUMB_ROOT, { label: 'Certificate Report' }],
      ...report,
    });
  } catch (err) {
    next(err);
  }
}

// One factory per export format instead of eight near-identical handlers —
// each of the four reports only differs in which service function and
// filename/title it uses.
function makeCsvExport(getReport, filename) {
  return async (req, res, next) => {
    try {
      const report = await getReport(req.query);
      csvExporter.sendCsv(res, filename, report.columns, report.rows);
    } catch (err) {
      next(err);
    }
  };
}

function makePdfExport(getReport, filename, title) {
  return async (req, res, next) => {
    try {
      const report = await getReport(req.query);
      pdfGenerator.streamTablePdf(res, {
        filename,
        title,
        subtitle: describeFilters(report.filters),
        columns: report.columns,
        rows: report.rows,
      });
    } catch (err) {
      next(err);
    }
  };
}

module.exports = {
  overview,
  eventReport,
  volunteerReport,
  donationReport,
  certificateReport,
  exportEventCsv: makeCsvExport(reportService.getEventReport, 'event-report.csv'),
  exportEventPdf: makePdfExport(reportService.getEventReport, 'event-report.pdf', 'Event Report'),
  exportVolunteerCsv: makeCsvExport(reportService.getVolunteerReport, 'volunteer-report.csv'),
  exportVolunteerPdf: makePdfExport(
    reportService.getVolunteerReport,
    'volunteer-report.pdf',
    'Volunteer Report'
  ),
  exportDonationCsv: makeCsvExport(reportService.getDonationReport, 'donation-report.csv'),
  exportDonationPdf: makePdfExport(
    reportService.getDonationReport,
    'donation-report.pdf',
    'Donation Report'
  ),
  exportCertificateCsv: makeCsvExport(reportService.getCertificateReport, 'certificate-report.csv'),
  exportCertificatePdf: makePdfExport(
    reportService.getCertificateReport,
    'certificate-report.pdf',
    'Certificate Report'
  ),
};
