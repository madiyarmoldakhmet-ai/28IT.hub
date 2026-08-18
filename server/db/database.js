const sqlite3 = require('sqlite3').verbose();
const { DB_PATH } = require('../config');

const db = new sqlite3.Database(DB_PATH);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) {
        reject(err);
        return;
      }
      resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
}

async function initDatabase() {
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS chats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      type TEXT NOT NULL DEFAULT 'group',
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS chat_members (
      chat_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (chat_id, user_id),
      FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      sender TEXT NOT NULL,
      repo_name TEXT NOT NULL,
      summary TEXT NOT NULL,
      payload_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Учёба & Доклады',
      repo_url TEXT,
      image_url TEXT,
      views INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS post_likes (
      post_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (post_id, user_id),
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS post_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      text TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Migration helpers for existing databases
  try {
    const chatsInfo = await all("PRAGMA table_info(chats)");
    const hasTypeColumn = chatsInfo.some((col) => col.name === 'type');
    if (!hasTypeColumn) {
      await run("ALTER TABLE chats ADD COLUMN type TEXT NOT NULL DEFAULT 'group'");
    }
  } catch (err) {
    console.error('Migration error (chats.type):', err);
  }

  try {
    const postsInfo = await all("PRAGMA table_info(posts)");
    const hasImageUrl = postsInfo.some((col) => col.name === 'image_url');
    if (!hasImageUrl) {
      await run('ALTER TABLE posts ADD COLUMN image_url TEXT');
    }
    const hasCategory = postsInfo.some((col) => col.name === 'category');
    if (!hasCategory) {
      await run("ALTER TABLE posts ADD COLUMN category TEXT NOT NULL DEFAULT 'Учёба & Доклады'");
    }
    const hasViews = postsInfo.some((col) => col.name === 'views');
    if (!hasViews) {
      await run("ALTER TABLE posts ADD COLUMN views INTEGER NOT NULL DEFAULT 0");
    }
  } catch (err) {
    console.error('Migration error (posts columns):', err);
  }

  try {
    const msgsInfo = await all("PRAGMA table_info(messages)");
    const hasAttachment = msgsInfo.some((col) => col.name === 'attachment_url');
    if (!hasAttachment) {
      await run('ALTER TABLE messages ADD COLUMN attachment_url TEXT');
    }
  } catch (err) {
    console.error('Migration error (messages.attachment_url):', err);
  }

  return db;
}

module.exports = {
  db,
  initDatabase,
  run,
  get,
  all,
};
