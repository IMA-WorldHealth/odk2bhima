
const express = require('express');
const router = new express.Router();

const stockCtrl = require('../controller/stock');

router.post('/depot_movement', stockCtrl.depot_movement);

module.exports = router;