const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  listChats,
  getChatMessages,
  createDirectChat,
  createGroupChat,
} = require('../controllers/chatController');

router.get('/chats', authenticate, listChats);
router.get('/chats/:chatId/messages', authenticate, getChatMessages);
router.post('/chats/direct', authenticate, createDirectChat);
router.post('/chats/group', authenticate, createGroupChat);

module.exports = router;
