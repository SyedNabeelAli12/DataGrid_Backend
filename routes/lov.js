const express = require('express');
const router = express.Router();
const lov = require('../controller/lov');

router.get('/', lov.getLOVs);

module.exports = router;