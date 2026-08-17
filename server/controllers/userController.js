const { all } = require('../db/database');

async function searchUsers(req, res) {
  try {
    const query = String(req.query.q || '').trim().toLowerCase();
    const currentUserId = req.user ? req.user.userId : 0;

    let users;
    if (!query) {
      users = await all(
        'SELECT id, username FROM users WHERE id != ? ORDER BY username ASC LIMIT 20',
        [currentUserId]
      );
    } else {
      users = await all(
        'SELECT id, username FROM users WHERE id != ? AND username LIKE ? ORDER BY username ASC LIMIT 20',
        [currentUserId, `%${query}%`]
      );
    }

    return res.json({ users });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to search users', error: error.message });
  }
}

module.exports = {
  searchUsers,
};
