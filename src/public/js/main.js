// Desktop sidebar collapse (icon-only), preference remembered across visits.
function initSidebarCollapse() {
  var btn = document.getElementById('sidebarCollapseBtn');
  var shell = document.getElementById('appShell');
  if (!btn || !shell) return;

  var STORAGE_KEY = 'cc_sidebar_collapsed';
  if (localStorage.getItem(STORAGE_KEY) === '1') {
    shell.classList.add('sidebar-collapsed');
  }

  btn.addEventListener('click', function () {
    var collapsed = shell.classList.toggle('sidebar-collapsed');
    localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
  });
}

// Mobile off-canvas sidebar drawer.
function initMobileSidebar() {
  var toggleBtn = document.getElementById('sidebarToggleBtn');
  var sidebar = document.getElementById('sidebar');
  var overlay = document.getElementById('sidebarOverlay');
  if (!toggleBtn || !sidebar || !overlay) return;

  function close() {
    sidebar.classList.remove('is-open');
    overlay.classList.remove('is-visible');
  }

  toggleBtn.addEventListener('click', function () {
    sidebar.classList.toggle('is-open');
    overlay.classList.toggle('is-visible');
  });
  overlay.addEventListener('click', close);
}

// Topbar user menu dropdown.
function initUserMenu() {
  var toggle = document.getElementById('userMenuToggle');
  var menu = document.getElementById('userMenu');
  if (!toggle || !menu) return;

  toggle.addEventListener('click', function (event) {
    event.stopPropagation();
    menu.classList.toggle('is-open');
  });
  document.addEventListener('click', function () {
    menu.classList.remove('is-open');
  });
}

// Time-of-day greeting (client-side, since the server doesn't know the
// visitor's local time) — progressively enhances the server-rendered
// "Welcome, {name}" heading on the dashboards.
function initGreeting() {
  var greeting = document.getElementById('greeting');
  if (!greeting) return;

  var hour = new Date().getHours();
  var timeOfDay = 'evening';
  if (hour < 12) timeOfDay = 'morning';
  else if (hour < 18) timeOfDay = 'afternoon';

  greeting.textContent = greeting.textContent.replace(/^Welcome,/, 'Good ' + timeOfDay + ',');
}

// Confirmation prompt for destructive actions (e.g. deleting an event) —
// any <form data-confirm="..."> gets a native confirm() dialog before it
// submits. Reusable by any future module's delete forms.
function initConfirmForms() {
  document.querySelectorAll('form[data-confirm]').forEach(function (form) {
    form.addEventListener('submit', function (event) {
      if (!window.confirm(form.getAttribute('data-confirm'))) {
        event.preventDefault();
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', function () {
  initSidebarCollapse();
  initMobileSidebar();
  initUserMenu();
  initGreeting();
  initConfirmForms();
});
