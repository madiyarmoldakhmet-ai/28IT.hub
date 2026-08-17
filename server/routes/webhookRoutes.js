const express = require('express');
const router = express.Router();
const { handleGiteaWebhook, listEvents } = require('../controllers/webhookController');

// POST /api/webhooks/gitea  — receives Gitea push/PR/issue events
router.post('/webhooks/gitea', handleGiteaWebhook);

// GET /api/webhooks/events  — returns last 50 events (for activity feed)
router.get('/webhooks/events', listEvents);

module.exports = router;
