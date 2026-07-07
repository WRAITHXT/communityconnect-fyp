const userModel = require('../models/userModel');
const eventModel = require('../models/eventModel');
const registrationModel = require('../models/registrationModel');
const attendanceModel = require('../models/attendanceModel');
const donationModel = require('../models/donationModel');
const certificateModel = require('../models/certificateModel');

// Icons match the sidebar entries in src/config/navigation.js for the same
// concept, so the two stay visually tied together. Cards/stats tied to a
// module that isn't implemented yet stay static placeholders
// (value: '—', status: 'Coming soon') until that module lands — see
// docs/PROJECT_BLUEPRINT.md, Section 7 for the phase order. "Upcoming
// Events" (user), "Total Events" (admin) since Phase 4, "My Event
// Registrations" (user) / "Total Volunteers" (admin) since Phase 5, "My
// Volunteer Hours" (user) since Phase 6, "My Donations" (user) / "Total
// Donations" (admin) since Phase 7, and "My Certificates" (user) / "Total
// Certificates" (admin) since Phase 8 are now live.
const USER_DASHBOARD_CARDS = [
  {
    key: 'notifications',
    title: 'Notifications',
    description: 'Stay updated on your registrations, events, and donations.',
    icon: 'fa-solid fa-bell',
  },
];

async function getUserDashboardCards(userId) {
  // Independent counts across 5 different tables — run concurrently rather
  // than sequentially (Phase 10 performance review). Each is its own
  // connection-pool query, not a chain of dependent lookups.
  const [upcomingEventsCount, myRegistrationsCount, totalHours, totalDonated, myCertificatesCount] =
    await Promise.all([
      eventModel.countUpcomingPublished(),
      registrationModel.countApprovedForUser(userId),
      attendanceModel.getTotalHoursForUser(userId),
      donationModel.getTotalForUser(userId),
      certificateModel.countForUser(userId),
    ]);

  const liveCards = [
    {
      key: 'upcomingEvents',
      title: 'Upcoming Events',
      description: 'Browse and register for upcoming community events.',
      icon: 'fa-solid fa-calendar-days',
      value: String(upcomingEventsCount),
      status: null,
      href: '/events',
    },
    {
      key: 'myRegistrations',
      title: 'My Event Registrations',
      description: 'Track the status of events you have applied to volunteer for.',
      icon: 'fa-solid fa-clipboard-list',
      value: String(myRegistrationsCount),
      status: null,
      href: '/my-registrations',
    },
    {
      key: 'myVolunteerHours',
      title: 'My Volunteer Hours',
      description: 'View your attendance history and total hours contributed.',
      icon: 'fa-solid fa-clock',
      value: String(totalHours),
      status: null,
      href: '/my-attendance',
    },
    {
      key: 'myDonations',
      title: 'My Donations',
      description: 'View your recorded donation history.',
      icon: 'fa-solid fa-hand-holding-heart',
      value: totalDonated.toFixed(2),
      status: null,
      href: '/my-donations',
    },
    {
      key: 'myCertificates',
      title: 'My Certificates',
      description: 'Download certificates for events you completed.',
      icon: 'fa-solid fa-award',
      value: String(myCertificatesCount),
      status: null,
      href: '/my-certificates',
    },
  ];

  const placeholderCards = USER_DASHBOARD_CARDS.map((card) => ({
    ...card,
    value: '—',
    status: 'Coming soon',
    href: null,
  }));

  return [...liveCards, ...placeholderCards];
}

// Total Users, Total Events, Total Volunteers, Total Donations, and Total
// Certificates are all real now (every module through Phase 8 is
// implemented).
async function getAdminStats() {
  const [totalUsers, totalEvents, totalVolunteers, totalDonations, totalCertificates] =
    await Promise.all([
      userModel.countUsers(),
      eventModel.countAll(),
      registrationModel.countDistinctActiveVolunteers(),
      donationModel.countAll(),
      certificateModel.countAll(),
    ]);

  return [
    {
      key: 'totalUsers',
      label: 'Total Users',
      value: totalUsers,
      isLive: true,
      icon: 'fa-solid fa-users',
    },
    {
      key: 'totalEvents',
      label: 'Total Events',
      value: totalEvents,
      isLive: true,
      icon: 'fa-solid fa-calendar-days',
    },
    {
      key: 'totalVolunteers',
      label: 'Total Volunteers',
      value: totalVolunteers,
      isLive: true,
      icon: 'fa-solid fa-people-group',
    },
    {
      key: 'totalDonations',
      label: 'Total Donations',
      value: totalDonations,
      isLive: true,
      icon: 'fa-solid fa-hand-holding-heart',
    },
    {
      key: 'totalCertificates',
      label: 'Total Certificates',
      value: totalCertificates,
      isLive: true,
      icon: 'fa-solid fa-award',
    },
  ];
}

// "Create Event" and "Manage Donations" are real (their modules are
// implemented). "Manage Registrations" stays disabled since there's no
// global cross-event registrations page (see config/navigation.js) — only
// the per-event view under Manage Events. Note: donations are always
// donor-submitted in this design (see docs/PHASE7_DONATION_MANAGEMENT.md)
// — there is no admin "create donation" action, only manage/edit/delete,
// so this quick action points at the donations list, not a create form.
// Similarly, certificates are always generated from a specific event's
// eligible-volunteer roster (see docs/PHASE8_CERTIFICATE_GENERATION.md),
// not from a standalone "create certificate" form, so this quick action
// points at the certificates list rather than a generic create page.
function getAdminQuickActions() {
  return [
    {
      key: 'createEvent',
      label: 'Create Event',
      icon: 'fa-solid fa-plus',
      href: '/admin/events/create',
    },
    {
      key: 'manageRegistrations',
      label: 'Manage Registrations',
      icon: 'fa-solid fa-clipboard-list',
      href: null,
    },
    {
      key: 'manageDonations',
      label: 'Manage Donations',
      icon: 'fa-solid fa-hand-holding-heart',
      href: '/admin/donations',
    },
    {
      key: 'manageCertificates',
      label: 'Manage Certificates',
      icon: 'fa-solid fa-award',
      href: '/admin/certificates',
    },
    {
      key: 'viewReports',
      label: 'View Reports',
      icon: 'fa-solid fa-chart-line',
      href: '/admin/reports',
    },
  ];
}

module.exports = { getUserDashboardCards, getAdminStats, getAdminQuickActions };
