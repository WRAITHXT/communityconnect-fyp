const userModel = require('../models/userModel');
const eventModel = require('../models/eventModel');
const registrationModel = require('../models/registrationModel');
const attendanceModel = require('../models/attendanceModel');

// Icons match the sidebar entries in src/config/navigation.js for the same
// concept, so the two stay visually tied together. Cards/stats tied to a
// module that isn't implemented yet stay static placeholders
// (value: '—', status: 'Coming soon') until that module lands — see
// docs/PROJECT_BLUEPRINT.md, Section 7 for the phase order. "Upcoming
// Events" (user), "Total Events" (admin) since Phase 4, "My Event
// Registrations" (user) / "Total Volunteers" (admin) since Phase 5, and "My
// Volunteer Hours" (user) since Phase 6 are now live.
const USER_DASHBOARD_CARDS = [
  {
    key: 'myDonations',
    title: 'My Donations',
    description: 'View your recorded donation history.',
    icon: 'fa-solid fa-hand-holding-heart',
  },
  {
    key: 'myCertificates',
    title: 'My Certificates',
    description: 'Download certificates for events you completed.',
    icon: 'fa-solid fa-award',
  },
  {
    key: 'notifications',
    title: 'Notifications',
    description: 'Stay updated on your registrations, events, and donations.',
    icon: 'fa-solid fa-bell',
  },
];

async function getUserDashboardCards(userId) {
  const upcomingEventsCount = await eventModel.countUpcomingPublished();
  const myRegistrationsCount = await registrationModel.countApprovedForUser(userId);
  const totalHours = await attendanceModel.getTotalHoursForUser(userId);

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
  ];

  const placeholderCards = USER_DASHBOARD_CARDS.map((card) => ({
    ...card,
    value: '—',
    status: 'Coming soon',
    href: null,
  }));

  return [...liveCards, ...placeholderCards];
}

// Total Users, Total Events, and Total Volunteers are real (Authentication,
// Event Management, and Volunteer Registration are all implemented). The
// rest stay placeholders until their respective modules are implemented.
async function getAdminStats() {
  const totalUsers = await userModel.countUsers();
  const totalEvents = await eventModel.countAll();
  const totalVolunteers = await registrationModel.countDistinctActiveVolunteers();

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
      value: '—',
      isLive: false,
      icon: 'fa-solid fa-hand-holding-heart',
    },
    {
      key: 'totalCertificates',
      label: 'Total Certificates',
      value: '—',
      isLive: false,
      icon: 'fa-solid fa-award',
    },
  ];
}

// "Create Event" is real (Event Management is implemented). The rest
// remain disabled until their modules exist. "Manage Registrations" stays
// disabled since there's no global cross-event registrations page (see
// config/navigation.js) — only the per-event view under Manage Events.
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
      key: 'recordDonation',
      label: 'Record Donation',
      icon: 'fa-solid fa-hand-holding-heart',
      href: null,
    },
    {
      key: 'generateCertificate',
      label: 'Generate Certificate',
      icon: 'fa-solid fa-award',
      href: null,
    },
    { key: 'viewReports', label: 'View Reports', icon: 'fa-solid fa-chart-line', href: null },
  ];
}

module.exports = { getUserDashboardCards, getAdminStats, getAdminQuickActions };
