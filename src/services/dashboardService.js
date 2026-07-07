const userModel = require('../models/userModel');

// All six cards are placeholder content by design (see Phase 3 instructions)
// — real data arrives with each feature module (Event Management, Volunteer
// Registration, Donation Recording, Certificate Generation, Notifications).
// Icons match the sidebar entries in src/config/navigation.js for the same
// concept, so the two stay visually tied together.
// See docs/PROJECT_BLUEPRINT.md, Section 7 for the phase order.
const USER_DASHBOARD_CARDS = [
  {
    key: 'upcomingEvents',
    title: 'Upcoming Events',
    description: 'Browse and register for upcoming community events.',
    icon: 'fa-solid fa-calendar-days',
  },
  {
    key: 'myRegistrations',
    title: 'My Event Registrations',
    description: 'Track the status of events you have applied to volunteer for.',
    icon: 'fa-solid fa-clipboard-list',
  },
  {
    key: 'myVolunteerHours',
    title: 'My Volunteer Hours',
    description: 'See your accumulated, verified volunteering hours.',
    icon: 'fa-solid fa-clock',
  },
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

function getUserDashboardCards() {
  return USER_DASHBOARD_CARDS.map((card) => ({ ...card, value: '—', status: 'Coming soon' }));
}

// Total Users is real (the Authentication module already exists). The rest
// stay placeholders until their respective modules are implemented.
async function getAdminStats() {
  const totalUsers = await userModel.countUsers();

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
      value: '—',
      isLive: false,
      icon: 'fa-solid fa-calendar-days',
    },
    {
      key: 'totalVolunteers',
      label: 'Total Volunteers',
      value: '—',
      isLive: false,
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

// Disabled by design — each action belongs to a module that isn't
// implemented yet.
function getAdminQuickActions() {
  return [
    { key: 'createEvent', label: 'Create Event', icon: 'fa-solid fa-plus' },
    { key: 'approveRegistrations', label: 'Approve Registrations', icon: 'fa-solid fa-check' },
    {
      key: 'recordDonation',
      label: 'Record Donation',
      icon: 'fa-solid fa-hand-holding-heart',
    },
    { key: 'generateCertificate', label: 'Generate Certificate', icon: 'fa-solid fa-award' },
    { key: 'viewReports', label: 'View Reports', icon: 'fa-solid fa-chart-line' },
  ];
}

module.exports = { getUserDashboardCards, getAdminStats, getAdminQuickActions };
