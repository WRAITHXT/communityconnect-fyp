const express = require('express');

const donationController = require('../../controllers/web/donationController');
const { verifyJwt } = require('../../middlewares/verifyJwt');
const { donationValidators } = require('../../validators/donationValidators');

const router = express.Router();

router.use(verifyJwt);

router.get('/my-donations', donationController.myDonations);
router.get('/donations/create', donationController.showCreateForm);
router.post('/donations', donationValidators, donationController.create);
router.get('/donations/:id', donationController.viewDonation);

module.exports = router;
