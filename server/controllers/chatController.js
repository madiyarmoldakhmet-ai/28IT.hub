const { get, all, run } = require('../db/database');

async function listChats(req, res) {
  try {
    const chats = await all(`
      SELECT
        c.id,
        c.name,
        c.created_at,
        (SELECT content FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) AS last_message,
        (SELECT username FROM users u JOIN messages m ON m.user_id = u.id WHERE m.chat_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_sender,
        (SELECT COUNT(*) FROM messages WHERE chat_id = c.id) AS messages_count
      FROM chats c
      ORDER BY c.created_at ASC
    `);

    return res.json({ chats });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to fetch chats', error: error.message });
  }
}

async function getChatMessages(req, res) {
  try {
    const chatId = Number(req.params.chatId);

    if (!chatId) {
      return res.status(400).json({ message: 'Chat ID is required' });
    }

    const chat = await get('SELECT id, name FROM chats WHERE id = ?', [chatId]);
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    const messages = await all(
      `SELECT
        m.id,
        m.chat_id AS chatId,
        m.user_id AS userId,
        u.username,
        m.content,
        m.created_at AS createdAt
      FROM messages m
      JOIN users u ON u.id = m.user_id
      WHERE m.chat_id = ?
      ORDER BY m.created_at ASC`,
      [chatId]
    );

    return res.json({ chat: { id: chat.id, name: chat.name }, messages });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to fetch message history', error: error.message });
  }
}

async function createChat(req, res) {
  try {
    const name = String(req.body.name || '').trim();

    if (!name) {
      return res.status(400).json({ message: 'Chat name is required' });
    }

    const chat = await run('INSERT INTO chats (name, created_by) VALUES (?, ?)', [name, req.user.userId]);
    return res.status(201).json({ chat: { id: chat.id, name, createdBy: req.user.userId } });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to create chat', error: error.message });
  }
}

module.exports = {
  listChats,
  getChatMessages,
  createChat,
};
