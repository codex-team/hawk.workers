const express = require('express');
const popTaskRoute = require('./popTask');
const pushTaskRoute = require('./pushTask');

const router = express.Router();

// Pop task route
router.get('/popTask/:workerName', popTaskRoute);

// Push task route
router.put('/pushTask/:workerName', pushTaskRoute);

module.exports = router;
