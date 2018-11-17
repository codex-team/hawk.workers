const express = require('express');
const popTaskRoute = require('./popTask');
const pushTaskRoute = require('./pushTask');

const router = express.Router();

router.get('/popTask/:workerName', popTaskRoute);
router.put('/pushTask/:workerName', pushTaskRoute);

module.exports = router;
