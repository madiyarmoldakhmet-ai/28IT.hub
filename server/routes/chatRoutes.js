const express = require('express');
const { listChats, getChatMessages, createChat } = require('../controllers/chatController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.get('/chats', authenticate, listChats);
router.get('/chats/:chatId/messages', authenticate, getChatMessages);
router.post('/chats', authenticate, createChat);

module.exports = router;
