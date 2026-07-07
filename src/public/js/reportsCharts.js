/* global Chart */
// Reports & Analytics — chart rendering. Runs only on the overview page
// (Chart.js is only loaded there — see views/pages/reports/overview.ejs).
//
// Colors: a validated categorical palette (see docs/PHASE9_REPORTS_ANALYTICS.md
// for the validator run) substituted onto this app's own neutral/text tokens
// — CHART_COLOR_1/2 are the palette's categorical slots 1 (blue) and 2
// (aqua); GRID_COLOR/TICK_COLOR are this app's own --color-border/
// --color-text-muted so charts sit flush with the rest of the design system.
(function () {
  var dataEl = document.getElementById('reportsChartData');
  if (!dataEl || typeof Chart === 'undefined') return;
  var data = JSON.parse(dataEl.textContent);

  var CHART_COLOR_1 = '#2a78d6';
  var CHART_COLOR_2 = '#1baf7a';
  var GRID_COLOR = '#e2e8f0';
  var TICK_COLOR = '#64748b';

  Chart.defaults.font.family = "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

  function scales(yLabel) {
    return {
      x: { grid: { display: false }, ticks: { color: TICK_COLOR } },
      y: {
        beginAtZero: true,
        grid: { color: GRID_COLOR },
        ticks: { color: TICK_COLOR, precision: 0 },
        title: yLabel ? { display: true, text: yLabel, color: TICK_COLOR } : undefined,
      },
    };
  }

  function lineChart(canvasId, labels, values, label) {
    var el = document.getElementById(canvasId);
    if (!el) return;
    // eslint-disable-next-line no-new
    new Chart(el, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: label,
            data: values,
            borderColor: CHART_COLOR_1,
            backgroundColor: CHART_COLOR_1,
            borderWidth: 2,
            borderCapStyle: 'round',
            borderJoinStyle: 'round',
            pointRadius: 4,
            pointBackgroundColor: CHART_COLOR_1,
            tension: 0.25,
          },
        ],
      },
      options: {
        plugins: { legend: { display: false } },
        interaction: { mode: 'index', intersect: false },
        scales: scales(),
      },
    });
  }

  function barChart(canvasId, labels, values, label) {
    var el = document.getElementById(canvasId);
    if (!el) return;
    // eslint-disable-next-line no-new
    new Chart(el, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: label,
            data: values,
            backgroundColor: CHART_COLOR_1,
            borderRadius: 4,
            maxBarThickness: 24,
          },
        ],
      },
      options: {
        plugins: { legend: { display: false } },
        scales: scales(),
      },
    });
  }

  function groupedBarChart(canvasId, labels, seriesA, seriesB, labelA, labelB) {
    var el = document.getElementById(canvasId);
    if (!el) return;
    // eslint-disable-next-line no-new
    new Chart(el, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: labelA,
            data: seriesA,
            backgroundColor: CHART_COLOR_1,
            borderRadius: 4,
            maxBarThickness: 24,
          },
          {
            label: labelB,
            data: seriesB,
            backgroundColor: CHART_COLOR_2,
            borderRadius: 4,
            maxBarThickness: 24,
          },
        ],
      },
      options: {
        plugins: { legend: { display: true, labels: { color: TICK_COLOR } } },
        interaction: { mode: 'index', intersect: false },
        scales: scales(),
      },
    });
  }

  lineChart(
    'chartRegistrations',
    data.registrationsOverTime.map(function (r) {
      return r.label;
    }),
    data.registrationsOverTime.map(function (r) {
      return r.count;
    }),
    'Registrations'
  );

  barChart(
    'chartHours',
    data.hoursByMonth.map(function (r) {
      return r.label;
    }),
    data.hoursByMonth.map(function (r) {
      return r.hours;
    }),
    'Hours'
  );

  barChart(
    'chartDonationsByType',
    data.donationsByType.map(function (r) {
      return r.label;
    }),
    data.donationsByType.map(function (r) {
      return r.total_amount;
    }),
    'Amount'
  );

  groupedBarChart(
    'chartAttendanceByEvent',
    data.attendanceByEvent.map(function (r) {
      return r.title;
    }),
    data.attendanceByEvent.map(function (r) {
      return r.total_registrations;
    }),
    data.attendanceByEvent.map(function (r) {
      return r.total_attendance;
    }),
    'Registered',
    'Attended'
  );

  lineChart(
    'chartCertificates',
    data.certificatesOverTime.map(function (r) {
      return r.label;
    }),
    data.certificatesOverTime.map(function (r) {
      return r.count;
    }),
    'Certificates'
  );
})();
