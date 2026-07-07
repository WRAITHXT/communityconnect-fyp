const attendanceModel = require('../../models/attendanceModel');
const { getAppShellLocals } = require('../../utils/viewHelpers');

// GET /my-attendance — "My Volunteer Hours": total hours earned plus a
// history of every event with a recorded (present/absent) outcome.
async function myAttendance(req, res, next) {
  try {
    const totalHours = await attendanceModel.getTotalHoursForUser(req.user.id);
    const history = await attendanceModel.listHistoryForUser(req.user.id);

    res.render('pages/attendance/my', {
      title: 'My Volunteer Hours - CommunityConnect',
      layout: 'layouts/app',
      ...getAppShellLocals(req),
      breadcrumbs: [{ label: 'Dashboard', href: '/dashboard' }, { label: 'My Volunteer Hours' }],
      totalHours,
      history,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { myAttendance };
