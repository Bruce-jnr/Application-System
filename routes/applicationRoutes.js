const express = require('express');
const multer = require('multer');
const applicationController = require('../controllers/applicationController');
const upload = multer({ dest: 'temp/' });

const router = express.Router();

router.post(
  '/',
  upload.fields([
    { name: 'idUpload', maxCount: 1 },
    { name: 'photo', maxCount: 1 },
  ]),
  applicationController.submitApplication
);

module.exports = router;
