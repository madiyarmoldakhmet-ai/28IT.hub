const { get, run, all } = require('../db/database');

function setupSocket(io) {
  io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    socket.on('join_chat', async ({ chatId, token }) => {
      try {
        if (!chatId) {
          socket.emit('error_message', { message: 'chatId is required' });
          return;
        }

        const chatExists = await get('SELECT id FROM chats WHERE id = ?', [chatId]);
        if (!chatExists) {
          socket.emit('error_message', { message: 'Chat not found' });
          return;
        }

        socket.join(`chat:${chatId}`);
        socket.data.chatId = chatId;

        const history = await all(
          `SELECT m.id, m.chat_id AS chatId, m.user_id AS userId, u.username, m.content, m.created_at AS createdAt
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

    socket.on('send_message', async ({ chatId, content, userId, username }) => {
      try {
        const trimmed = String(content || '').trim();

        if (!chatId || !trimmed || !userId) {
          socket.emit('error_message', { message: 'Invalid message payload' });
          return;
        }

        const user = await get('SELECT id, username FROM users WHERE id = ?', [userId]);
        if (!user) {
          socket.emit('error_message', { message: 'User not found' });
          return;
        }

        const message = await run(
          'INSERT INTO messages (chat_id, user_id, content) VALUES (?, ?, ?)',
          [chatId, userId, trimmed]
        );

        const savedMessage = {
          id: message.id,
          chatId,
          userId: user.id,
          username: user.username,
          content: trimmed,
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
