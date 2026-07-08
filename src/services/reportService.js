const userModel = require('../models/userModel');
const eventModel = require('../models/eventModel');
const registrationModel = require('../models/registrationModel');
const attendanceModel = require('../models/attendanceModel');
const donationModel = require('../models/donationModel');
const certificateModel = require('../models/certificateModel');
const verificationLogModel = require('../models/verificationLogModel');
const reportModel = require('../models/reportModel');
const { parsePositiveIntParam } = require('../utils/viewHelpers');
const { formatDate } = require('../utils/format');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Query-string filters are untrusted strings — a malformed date must never
// reach a `::date` cast in SQL (that throws a raw driver error), so anything
// that doesn't look like a real calendar date is dropped rather than passed
// through. Mirrors viewHelpers.parsePositiveIntParam's "reject, don't crash"
// approach for the id filters below.
function parseDateParam(value) {
  if (!value || !DATE_RE.test(value)) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : value;
}

function parseIdParam(value) {
  const parsed = parsePositiveIntParam(value);
  return parsed === null ? undefined : parsed;
}

function parseEnumParam(value, allowed) {
  return allowed.includes(value) ? value : undefined;
}

function parseCommonFilters(query) {
  return {
    dateFrom: parseDateParam(query.dateFrom),
    dateTo: parseDateParam(query.dateTo),
  };
}

function attendanceRate(row) {
  if (row.total_registrations === 0) return 0;
  return Math.round((row.total_attendance / row.total_registrations) * 100);
}

// ---- Analytics overview (9 stats + 5 charts) ----
async function getAnalyticsOverview() {
  const [
    totalUsers,
    totalEvents,
    publishedEvents,
    totalRegistrations,
    totalAttended,
    totalHours,
    donationStats,
    totalCertificates,
    registrationsOverTime,
    hoursByMonth,
    donationsByType,
    attendanceByEvent,
    certificatesOverTime,
  ] = await Promise.all([
    userModel.countUsers(),
    eventModel.countAll(),
    eventModel.countPublished(),
    registrationModel.countAll(),
    attendanceModel.countAttended(),
    attendanceModel.getTotalHoursAll(),
    donationModel.getAdminStats(),
    certificateModel.countAll(),
    reportModel.getRegistrationsOverTime(),
    reportModel.getVolunteerHoursByMonth(),
    donationModel.getSummaryByType(),
    reportModel.getAttendanceByEvent(),
    reportModel.getCertificatesOverTime(),
  ]);

  return {
    stats: {
      totalUsers,
      totalEvents,
      publishedEvents,
      totalRegistrations,
      totalAttended,
      totalHours,
      totalDonations: donationStats.totalDonations,
      totalDonationAmount: donationStats.totalAmountReceived,
      totalCertificates,
    },
    charts: {
      registrationsOverTime,
      hoursByMonth,
      donationsByType,
      attendanceByEvent,
      certificatesOverTime,
    },
  };
}

// ---- Event Report ----
const EVENT_REPORT_COLUMNS = [
  { key: 'title', label: 'Event' },
  { key: 'category_name', label: 'Category' },
  { key: 'status', label: 'Status' },
  { key: 'start_datetime', label: 'Start', format: (row) => formatDate(row.start_datetime) },
  { key: 'capacity', label: 'Capacity' },
  { key: 'total_registrations', label: 'Registrations' },
  { key: 'total_attendance', label: 'Attendance' },
  { key: 'attendance_rate', label: 'Attendance Rate (%)' },
  { key: 'remaining_capacity', label: 'Remaining Capacity' },
];

async function getEventReport(query) {
  const filters = {
    ...parseCommonFilters(query),
    eventId: parseIdParam(query.eventId),
  };
  const rows = await reportModel.getEventReport(filters);
  const events = await eventModel.list({});
  return {
    filters,
    events,
    rows: rows.map((row) => ({ ...row, attendance_rate: attendanceRate(row) })),
    columns: EVENT_REPORT_COLUMNS,
  };
}

// ---- Volunteer Report ----
const VOLUNTEER_REPORT_COLUMNS = [
  { key: 'name', label: 'Volunteer' },
  { key: 'email', label: 'Email' },
  { key: 'registered_events', label: 'Registered Events' },
  { key: 'events_attended', label: 'Events Attended' },
  { key: 'total_hours', label: 'Total Hours', format: (row) => row.total_hours.toFixed(2) },
  { key: 'certificates_earned', label: 'Certificates Earned' },
];

async function getVolunteerReport(query) {
  const filters = {
    ...parseCommonFilters(query),
    userId: parseIdParam(query.userId),
  };
  const rows = await reportModel.getVolunteerReport(filters);
  const volunteers = await userModel.listByRole('user');
  return { filters, volunteers, rows, columns: VOLUNTEER_REPORT_COLUMNS };
}

// ---- Donation Report ----
// Amount stays a plain number here (no "RM" prefix) — CSV/spreadsheet
// consumers need it numeric to sum/sort, so the currency is called out in
// its own column instead of being baked into the amount text. The on-screen
// report page (pages/reports/donations.ejs) shows the "RM 1,150.00" format
// via formatCurrency(); this columns array only feeds the CSV/PDF exports.
const DONATION_REPORT_COLUMNS = [
  { key: 'donor_name', label: 'Donor' },
  { key: 'donation_type', label: 'Type' },
  {
    key: 'amount',
    label: 'Amount',
    format: (row) => (row.amount === null ? '' : Number(row.amount).toFixed(2)),
  },
  { key: 'currency', label: 'Currency', format: (row) => (row.amount === null ? '' : 'MYR') },
  { key: 'donated_at', label: 'Date', format: (row) => formatDate(row.donated_at) },
  { key: 'status', label: 'Status' },
];
const DONATION_TYPES = ['monetary', 'food', 'clothing', 'medical_supplies', 'other'];
const DONATION_STATUSES = ['completed', 'pending', 'cancelled'];

async function getDonationReport(query) {
  const filters = {
    ...parseCommonFilters(query),
    donationType: parseEnumParam(query.donationType, DONATION_TYPES),
    status: parseEnumParam(query.status, DONATION_STATUSES),
  };
  const [rows, byType, byStatus, totals] = await Promise.all([
    reportModel.getDonationReportRows(filters),
    reportModel.getDonationReportByType(filters),
    reportModel.getDonationReportByStatus(filters),
    reportModel.getDonationReportTotals(filters),
  ]);
  return { filters, rows, byType, byStatus, totals, columns: DONATION_REPORT_COLUMNS };
}

// ---- Certificate Report ----
const CERTIFICATE_REPORT_COLUMNS = [
  { key: 'certificate_number', label: 'Certificate ID' },
  { key: 'volunteer_name', label: 'Volunteer' },
  { key: 'event_title', label: 'Event' },
  { key: 'total_hours', label: 'Hours', format: (row) => Number(row.total_hours).toFixed(2) },
  { key: 'issued_at', label: 'Issue Date', format: (row) => formatDate(row.issued_at) },
  { key: 'status', label: 'Status' },
];

async function getCertificateReport(query) {
  const filters = {
    ...parseCommonFilters(query),
    eventId: parseIdParam(query.eventId),
    userId: parseIdParam(query.userId),
    status: parseEnumParam(query.status, ['active', 'revoked']),
  };
  const [rows, stats, verification, events, volunteers] = await Promise.all([
    reportModel.getCertificateReportRows(filters),
    reportModel.getCertificateReportStats(filters),
    verificationLogModel.getStats(filters),
    eventModel.list({}),
    userModel.listByRole('user'),
  ]);
  return {
    filters,
    events,
    volunteers,
    rows,
    stats,
    verification,
    columns: CERTIFICATE_REPORT_COLUMNS,
  };
}

module.exports = {
  getAnalyticsOverview,
  getEventReport,
  getVolunteerReport,
  getDonationReport,
  getCertificateReport,
  EVENT_REPORT_COLUMNS,
  VOLUNTEER_REPORT_COLUMNS,
  DONATION_REPORT_COLUMNS,
  CERTIFICATE_REPORT_COLUMNS,
  DONATION_TYPES,
  DONATION_STATUSES,
};
