const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { searchUsers } = require('../controllers/userController');

router.get('/users/search', authenticate, searchUsers);

module.exports = router;
