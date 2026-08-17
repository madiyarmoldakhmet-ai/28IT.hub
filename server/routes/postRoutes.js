const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getPosts,
  getPostById,
  createPost,
  toggleLike,
  getComments,
  addComment,
} = require('../controllers/postsController');

// GET  /api/posts             — list all posts (with optional ?category= and ?userId=)
router.get('/posts', authenticate, getPosts);

// GET  /api/posts/:id         — detailed post view + increment view count
router.get('/posts/:id', authenticate, getPostById);

// POST /api/posts             — create a new post
router.post('/posts', authenticate, createPost);

// POST /api/posts/:id/like    — toggle like on a post
router.post('/posts/:id/like', authenticate, toggleLike);

// GET  /api/posts/:id/comments — list comments for a post
router.get('/posts/:id/comments', authenticate, getComments);

// POST /api/posts/:id/comments — add a comment to a post
router.post('/posts/:id/comments', authenticate, addComment);

module.exports = router;
