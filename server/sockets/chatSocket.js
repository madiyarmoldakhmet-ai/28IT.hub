const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../config');
const { get, run, all } = require('../db/database');

function verifyToken(token) {
  try {
    if (!token) return null;
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

function setupSocket(io) {
  io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    socket.on('join_chat', async ({ chatId, token, userId }) => {
      try {
        if (!chatId) {
          socket.emit('error_message', { message: 'chatId is required' });
          return;
        }

        const decoded = verifyToken(token);
        const effectiveUserId = decoded ? decoded.userId : Number(userId);

        if (!effectiveUserId) {
          socket.emit('error_message', { message: 'Authentication required' });
          return;
        }

        const isMember = await get(
          'SELECT chat_id FROM chat_members WHERE chat_id = ? AND user_id = ?',
          [chatId, effectiveUserId]
        );

        if (!isMember) {
          socket.emit('error_message', { message: 'Access denied: Not a member of this chat' });
          return;
        }

        socket.join(`chat:${chatId}`);
        socket.data.chatId = chatId;
        socket.data.userId = effectiveUserId;

        const history = await all(
          `SELECT m.id, m.chat_id AS chatId, m.user_id AS userId, u.username,
                  m.content, m.attachment_url AS attachmentUrl, m.created_at AS createdAt
           FROM messages m
           JOIN users u ON u.id = m.user_id
           WHERE m.chat_id = ?
           ORDER BY m.created_at ASC`,
          [chatId]
        );

        socket.emit('chat_joined', { chatId, history });
      } catch (error) {
        socket.emit('error_message', { message: 'Unable to join chat', error: error.message });
      }
    });

    socket.on('send_message', async ({ chatId, content, attachmentUrl, userId, token }) => {
      try {
        const trimmed = String(content || '').trim();
        const safeAttachment = attachmentUrl && attachmentUrl.startsWith('/uploads/') ? attachmentUrl : null;

        const decoded = verifyToken(token);
        const effectiveUserId = decoded ? decoded.userId : Number(userId);

        // Either text OR attachment must be present
        if (!chatId || (!trimmed && !safeAttachment) || !effectiveUserId) {
          socket.emit('error_message', { message: 'Invalid message payload' });
          return;
        }

        const isMember = await get(
          'SELECT chat_id FROM chat_members WHERE chat_id = ? AND user_id = ?',
          [chatId, effectiveUserId]
        );

        if (!isMember) {
          socket.emit('error_message', { message: 'Access denied: Cannot send message to chat' });
          return;
        }

        const user = await get('SELECT id, username FROM users WHERE id = ?', [effectiveUserId]);
        if (!user) {
          socket.emit('error_message', { message: 'User not found' });
          return;
        }

        const message = await run(
          'INSERT INTO messages (chat_id, user_id, content, attachment_url) VALUES (?, ?, ?, ?)',
          [chatId, effectiveUserId, trimmed || '', safeAttachment]
        );

        const savedMessage = {
          id: message.id,
          chatId,
          userId: user.id,
          username: user.username,
          content: trimmed,
          attachmentUrl: safeAttachment,
          createdAt: new Date().toISOString(),
        };

        io.to(`chat:${chatId}`).emit('receive_message', savedMessage);
      } catch (error) {
        socket.emit('error_message', { message: 'Unable to send message', error: error.message });
      }
    });

    socket.on('typing_status', ({ chatId, userId, username, isTyping }) => {
      if (!chatId || !userId) return;
      socket.to(`chat:${chatId}`).emit('typing_status', {
        chatId,
        userId,
        username,
        isTyping,
      });
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });
}

module.exports = {
  setupSocket,
};
