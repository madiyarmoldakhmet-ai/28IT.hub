const { run, get, all } = require('../db/database');

// GET /api/posts — all posts with category filtering, user_id filtering, commit count from events, views, likes
async function getPosts(req, res) {
  try {
    const { category, userId } = req.query;
    const currentUserId = req.user ? req.user.userId : null;

    let sql = `
      SELECT
        p.id,
        p.title,
        p.description,
        p.category,
        p.repo_url,
        p.image_url,
        p.views,
        p.created_at,
        u.username AS author,
        u.id AS user_id,
        (SELECT COUNT(*) FROM post_comments pc WHERE pc.post_id = p.id) AS comment_count,
        (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) AS like_count,
        (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id AND pl.user_id = ?) AS is_liked
      FROM posts p
      JOIN users u ON u.id = p.user_id
    `;

    const params = [currentUserId || 0];
    const conditions = [];

    if (category && category !== 'Все') {
      conditions.push('p.category = ?');
      params.push(category);
    }

    if (userId) {
      conditions.push('p.user_id = ?');
      params.push(Number(userId));
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY p.created_at DESC';

    const posts = await all(sql, params);

    // Calculate commits count for posts that have repo_url
    for (const post of posts) {
      if (post.repo_url) {
        // extract repo name if possible or search matching repo in events
        const events = await all(
          `SELECT payload_json FROM events WHERE event_type = 'push'`
        );
        let commitsCount = 0;
        for (const ev of events) {
          try {
            const payload = JSON.parse(ev.payload_json || '{}');
            const repoFull = payload.repository ? payload.repository.full_name : '';
            const repoHtmlUrl = payload.repository ? payload.repository.html_url : '';
            if (
              (repoFull && post.repo_url.includes(repoFull)) ||
              (repoHtmlUrl && post.repo_url.includes(repoHtmlUrl)) ||
              (payload.repository && payload.repository.name && post.repo_url.includes(payload.repository.name))
            ) {
              commitsCount += Array.isArray(payload.commits) ? payload.commits.length : 1;
            }
          } catch (e) {}
        }
        post.commit_count = commitsCount;
      } else {
        post.commit_count = 0;
      }
    }

    return res.json({ posts });
  } catch (err) {
    console.error('getPosts error:', err);
    return res.status(500).json({ message: 'Ошибка загрузки публикаций' });
  }
}

// GET /api/posts/:id — detailed post view + increment view count
async function getPostById(req, res) {
  try {
    const postId = Number(req.params.id);
    const currentUserId = req.user ? req.user.userId : null;

    // Increment views
    await run('UPDATE posts SET views = views + 1 WHERE id = ?', [postId]);

    const post = await get(
      `
      SELECT
        p.id,
        p.title,
        p.description,
        p.category,
        p.repo_url,
        p.image_url,
        p.views,
        p.created_at,
        u.username AS author,
        u.id AS user_id,
        (SELECT COUNT(*) FROM post_comments pc WHERE pc.post_id = p.id) AS comment_count,
        (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) AS like_count,
        (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id AND pl.user_id = ?) AS is_liked
      FROM posts p
      JOIN users u ON u.id = p.user_id
      WHERE p.id = ?
    `,
      [currentUserId || 0, postId]
    );

    if (!post) {
      return res.status(404).json({ message: 'Проект не найден' });
    }

    // Commits count
    let commitsCount = 0;
    if (post.repo_url) {
      const events = await all(`SELECT payload_json FROM events WHERE event_type = 'push'`);
      for (const ev of events) {
        try {
          const payload = JSON.parse(ev.payload_json || '{}');
          const repoFull = payload.repository ? payload.repository.full_name : '';
          if (repoFull && post.repo_url.includes(repoFull)) {
            commitsCount += Array.isArray(payload.commits) ? payload.commits.length : 1;
          }
        } catch (e) {}
      }
    }
    post.commit_count = commitsCount;

    return res.json({ post });
  } catch (err) {
    console.error('getPostById error:', err);
    return res.status(500).json({ message: 'Ошибка получения проекта' });
  }
}

// POST /api/posts — create a new post
async function createPost(req, res) {
  try {
    const { title, description, category, repo_url, image_url } = req.body;
    const userId = req.user.userId;

    if (!title || !title.trim()) {
      return res.status(400).json({ message: 'Поле "Название" обязательно' });
    }
    if (!description || !description.trim()) {
      return res.status(400).json({ message: 'Поле "Описание" обязательно' });
    }

    const safeCategory = category && category.trim() ? category.trim() : '3D-Печать';
    const safeRepoUrl = repo_url && repo_url.trim() ? repo_url.trim() : null;
    const safeImageUrl = image_url && image_url.trim() ? image_url.trim() : null;

    const result = await run(
      'INSERT INTO posts (user_id, title, description, category, repo_url, image_url) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, title.trim(), description.trim(), safeCategory, safeRepoUrl, safeImageUrl]
    );

    const post = await get(
      `
      SELECT
        p.id, p.title, p.description, p.category, p.repo_url, p.image_url, p.views, p.created_at,
        u.username AS author, u.id AS user_id,
        0 AS comment_count, 0 AS like_count, 0 AS is_liked, 0 AS commit_count
      FROM posts p
      JOIN users u ON u.id = p.user_id
      WHERE p.id = ?
    `,
      [result.id]
    );

    return res.status(201).json({ post });
  } catch (err) {
    console.error('createPost error:', err);
    return res.status(500).json({ message: 'Ошибка создания публикации' });
  }
}

// POST /api/posts/:id/like — toggle like
async function toggleLike(req, res) {
  try {
    const postId = Number(req.params.id);
    const userId = req.user.userId;

    const existing = await get(
      'SELECT post_id FROM post_likes WHERE post_id = ? AND user_id = ?',
      [postId, userId]
    );

    let isLiked = false;
    if (existing) {
      await run('DELETE FROM post_likes WHERE post_id = ? AND user_id = ?', [postId, userId]);
      isLiked = false;
    } else {
      await run('INSERT INTO post_likes (post_id, user_id) VALUES (?, ?)', [postId, userId]);
      isLiked = true;
    }

    const likeCountRow = await get(
      'SELECT COUNT(*) AS count FROM post_likes WHERE post_id = ?',
      [postId]
    );

    return res.json({ isLiked, likeCount: likeCountRow.count });
  } catch (err) {
    console.error('toggleLike error:', err);
    return res.status(500).json({ message: 'Ошибка обновления лайка' });
  }
}

// GET /api/posts/:id/comments — comments with author username
async function getComments(req, res) {
  try {
    const postId = Number(req.params.id);
    const comments = await all(
      `
      SELECT
        pc.id, pc.text, pc.created_at,
        u.username AS author, u.id AS user_id
      FROM post_comments pc
      JOIN users u ON u.id = pc.user_id
      WHERE pc.post_id = ?
      ORDER BY pc.created_at ASC
    `,
      [postId]
    );
    return res.json({ comments });
  } catch (err) {
    console.error('getComments error:', err);
    return res.status(500).json({ message: 'Ошибка загрузки комментариев' });
  }
}

// POST /api/posts/:id/comments — add a comment
async function addComment(req, res) {
  try {
    const postId = Number(req.params.id);
    const userId = req.user.userId;
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ message: 'Комментарий не может быть пустым' });
    }

    const post = await get('SELECT id FROM posts WHERE id = ?', [postId]);
    if (!post) {
      return res.status(404).json({ message: 'Публикация не найдена' });
    }

    const result = await run(
      'INSERT INTO post_comments (post_id, user_id, text) VALUES (?, ?, ?)',
      [postId, userId, text.trim()]
    );

    const comment = await get(
      `
      SELECT pc.id, pc.text, pc.created_at, u.username AS author, u.id AS user_id
      FROM post_comments pc
      JOIN users u ON u.id = pc.user_id
      WHERE pc.id = ?
    `,
      [result.id]
    );

    return res.status(201).json({ comment });
  } catch (err) {
    console.error('addComment error:', err);
    return res.status(500).json({ message: 'Ошибка добавления комментария' });
  }
}

module.exports = { getPosts, getPostById, createPost, toggleLike, getComments, addComment };
