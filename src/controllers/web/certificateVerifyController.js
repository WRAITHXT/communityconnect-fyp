const { validationResult } = require('express-validator');

const certificateService = require('../../services/certificateService');

function renderForm(req, res, { errors = [], values = {}, result = null } = {}, statusCode = 200) {
  res.status(statusCode).render('pages/verifyCertificate', {
    title: 'Verify a Certificate - CommunityConnect',
    layout: 'layouts/simple',
    errors,
    values,
    result,
  });
}

function showForm(req, res) {
  renderForm(req, res);
}

// Public — no authentication. Deliberately reports only Valid/Invalid (see
// certificateService.verifyCertificate) so this page can't be used to probe
// for which certificate numbers exist.
async function verify(req, res, next) {
  try {
    const fieldErrors = validationResult(req)
      .array()
      .map((e) => e.msg);
    if (fieldErrors.length > 0) {
      return renderForm(req, res, { errors: fieldErrors, values: req.body }, 400);
    }

    const { certificateNumber, verificationCode } = req.body;
    const result = await certificateService.verifyCertificate(certificateNumber, verificationCode);

    renderForm(req, res, { values: req.body, result });
  } catch (err) {
    next(err);
  }
}

module.exports = { showForm, verify };
