const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { upload, handleUpload } = require('../controllers/uploadController');

// POST /api/upload — upload an image, returns { url: '/uploads/filename.jpg' }
router.post('/upload', authenticate, upload.single('file'), handleUpload);

module.exports = router;
