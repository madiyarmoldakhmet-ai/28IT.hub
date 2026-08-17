const { get, all, run } = require('../db/database');

async function listChats(req, res) {
  try {
    const currentUserId = req.user.userId;

    // Get all chats where current user is a member
    const userChats = await all(
      `SELECT
        c.id,
        c.name,
        c.type,
        c.created_at,
        (SELECT content FROM messages WHERE chat_id = c.id ORDER BY created_at DESC LIMIT 1) AS last_message,
        (SELECT username FROM users u JOIN messages m ON m.user_id = u.id WHERE m.chat_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_sender,
        (SELECT COUNT(*) FROM chat_members WHERE chat_id = c.id) AS member_count,
        (SELECT u.username FROM users u JOIN chat_members cm ON cm.user_id = u.id WHERE cm.chat_id = c.id AND cm.user_id != ? LIMIT 1) AS other_username,
        (SELECT u.id FROM users u JOIN chat_members cm ON cm.user_id = u.id WHERE cm.chat_id = c.id AND cm.user_id != ? LIMIT 1) AS other_user_id
      FROM chats c
      JOIN chat_members cm_user ON cm_user.chat_id = c.id
      WHERE cm_user.user_id = ?
      ORDER BY (SELECT COALESCE(MAX(created_at), c.created_at) FROM messages WHERE chat_id = c.id) DESC`,
      [currentUserId, currentUserId, currentUserId]
    );

    const chats = userChats.map((chat) => {
      let displayName = chat.name;
      if (chat.type === 'direct') {
        displayName = chat.other_username || 'Неизвестный пользователь';
      }
      return {
        id: chat.id,
        name: displayName,
        raw_name: chat.name,
        type: chat.type || 'group',
        created_at: chat.created_at,
        last_message: chat.last_message,
        last_sender: chat.last_sender,
        member_count: chat.member_count,
        other_user_id: chat.other_user_id,
        other_username: chat.other_username,
      };
    });

    return res.json({ chats });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to fetch chats', error: error.message });
  }
}

async function getChatMessages(req, res) {
  try {
    const chatId = Number(req.params.chatId);
    const currentUserId = req.user.userId;

    if (!chatId) {
      return res.status(400).json({ message: 'Chat ID is required' });
    }

    // Verify user is a member of this chat
    const membership = await get(
      'SELECT chat_id FROM chat_members WHERE chat_id = ? AND user_id = ?',
      [chatId, currentUserId]
    );

    if (!membership) {
      return res.status(403).json({ message: 'Access denied: You are not a member of this chat' });
    }

    const chat = await get('SELECT id, name, type FROM chats WHERE id = ?', [chatId]);
    if (!chat) {
      return res.status(404).json({ message: 'Chat not found' });
    }

    let displayName = chat.name;
    let otherUser = null;

    if (chat.type === 'direct') {
      otherUser = await get(
        `SELECT u.id, u.username FROM users u
         JOIN chat_members cm ON cm.user_id = u.id
         WHERE cm.chat_id = ? AND cm.user_id != ?`,
        [chatId, currentUserId]
      );
      displayName = otherUser ? otherUser.username : 'Неизвестный пользователь';
    }

    const memberCountRow = await get('SELECT COUNT(*) AS count FROM chat_members WHERE chat_id = ?', [chatId]);
    const memberCount = memberCountRow ? memberCountRow.count : 0;

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

    return res.json({
      chat: {
        id: chat.id,
        name: displayName,
        type: chat.type,
        memberCount,
        otherUser,
      },
      messages,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to fetch message history', error: error.message });
  }
}

async function createDirectChat(req, res) {
  try {
    const currentUserId = req.user.userId;
    const targetUserId = Number(req.body.targetUserId);

    if (!targetUserId) {
      return res.status(400).json({ message: 'Target user ID is required' });
    }

    if (targetUserId === currentUserId) {
      return res.status(400).json({ message: 'Cannot create direct chat with yourself' });
    }

    const targetUser = await get('SELECT id, username FROM users WHERE id = ?', [targetUserId]);
    if (!targetUser) {
      return res.status(404).json({ message: 'Target user not found' });
    }

    // Check if DM already exists between these 2 users
    const existingChat = await get(
      `SELECT c.id FROM chats c
       JOIN chat_members cm1 ON cm1.chat_id = c.id AND cm1.user_id = ?
       JOIN chat_members cm2 ON cm2.chat_id = c.id AND cm2.user_id = ?
       WHERE c.type = 'direct'`,
      [currentUserId, targetUserId]
    );

    if (existingChat) {
      return res.json({
        chat: {
          id: existingChat.id,
          name: targetUser.username,
          type: 'direct',
          otherUserId: targetUser.id,
          otherUsername: targetUser.username,
        },
      });
    }

    // Create new direct chat
    const newChat = await run("INSERT INTO chats (name, type, created_by) VALUES ('', 'direct', ?)", [
      currentUserId,
    ]);

    await run('INSERT INTO chat_members (chat_id, user_id) VALUES (?, ?)', [newChat.id, currentUserId]);
    await run('INSERT INTO chat_members (chat_id, user_id) VALUES (?, ?)', [newChat.id, targetUserId]);

    return res.status(201).json({
      chat: {
        id: newChat.id,
        name: targetUser.username,
        type: 'direct',
        otherUserId: targetUser.id,
        otherUsername: targetUser.username,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to create direct chat', error: error.message });
  }
}

async function createGroupChat(req, res) {
  try {
    const currentUserId = req.user.userId;
    const name = String(req.body.name || '').trim();
    const rawUserIds = Array.isArray(req.body.userIds) ? req.body.userIds : [];

    if (!name) {
      return res.status(400).json({ message: 'Group name is required' });
    }

    // Set of member IDs including current user
    const memberIds = new Set([currentUserId]);
    rawUserIds.forEach((id) => {
      const num = Number(id);
      if (num) memberIds.add(num);
    });

    const newChat = await run("INSERT INTO chats (name, type, created_by) VALUES (?, 'group', ?)", [
      name,
      currentUserId,
    ]);

    for (const userId of memberIds) {
      await run('INSERT INTO chat_members (chat_id, user_id) VALUES (?, ?)', [newChat.id, userId]);
    }

    return res.status(201).json({
      chat: {
        id: newChat.id,
        name,
        type: 'group',
        memberCount: memberIds.size,
        createdBy: currentUserId,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to create group chat', error: error.message });
  }
}

module.exports = {
  listChats,
  getChatMessages,
  createDirectChat,
  createGroupChat,
};
