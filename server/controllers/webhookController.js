const crypto = require('crypto');
const { run, all } = require('../db/database');

function verifySignature(req) {
  const secret = process.env.GITEA_WEBHOOK_SECRET;
  if (!secret) {
    // If secret is not configured in .env, skip verification
    return true;
  }

  const signature = req.headers['x-gitea-signature'] || req.headers['x-hub-signature-256'] || '';
  if (!signature) {
    // If Gitea didn't send a signature, allow request unless strict mode is enabled
    return true;
  }

  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  const expectedSig = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

  try {
    const sigBuf = Buffer.from(signature, 'hex');
    const expBuf = Buffer.from(expectedSig, 'hex');
    if (sigBuf.length !== expBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, expBuf);
  } catch (err) {
    return false;
  }
}

async function handleGiteaWebhook(req, res) {
  try {
    if (!verifySignature(req)) {
      return res.status(401).json({ message: 'Invalid Gitea webhook signature' });
    }

    const eventType = req.headers['x-gitea-event'] || req.body.event || 'unknown';
    const payload = req.body || {};

    const repoName = payload.repository ? payload.repository.full_name : 'unknown/repo';
    const sender = payload.sender ? payload.sender.username : (payload.pusher ? payload.pusher.username : 'system');

    let summary = '';

    if (eventType === 'push') {
      const ref = payload.ref || 'main';
      const branch = ref.replace(/^refs\/heads\//, '');
      const commitsCount = Array.isArray(payload.commits) ? payload.commits.length : 0;
      summary = `[Push] ${sender} запушил(а) ${commitsCount} коммит(ов) в ветку "${branch}" (репозиторий: ${repoName})`;
    } else if (eventType === 'pull_request') {
      const action = payload.action || 'opened';
      const prTitle = payload.pull_request ? payload.pull_request.title : '';
      const isMerged = payload.pull_request && payload.pull_request.merged;
      const statusText = isMerged ? 'замерджил(а)' : (action === 'opened' ? 'открыл(а)' : action);
      summary = `[Pull Request] ${sender} ${statusText} PR "${prTitle}" в ${repoName}`;
    } else if (eventType === 'issues') {
      const action = payload.action || 'opened';
      const issueTitle = payload.issue ? payload.issue.title : '';
      const statusText = action === 'opened' ? 'создал(а)' : (action === 'closed' ? 'закрыл(а)' : action);
      summary = `[Issue] ${sender} ${statusText} задачу "${issueTitle}" в ${repoName}`;
    } else {
      summary = `[${eventType}] Событие от ${sender} в ${repoName}`;
    }

    // Save event into database
    const dbResult = await run(
      'INSERT INTO events (event_type, sender, repo_name, summary, payload_json) VALUES (?, ?, ?, ?, ?)',
      [eventType, sender, repoName, summary, JSON.stringify(payload)]
    );

    const eventData = {
      id: dbResult.id,
      eventType,
      sender,
      repoName,
      summary,
      createdAt: new Date().toISOString(),
    };

    // Broadcast via Socket.io to all connected clients
    const io = req.app.get('io');
    if (io) {
      io.emit('gitea_event', eventData);
    }

    return res.status(200).json({ status: 'ok', event: eventData });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return res.status(500).json({ message: 'Error processing webhook', error: error.message });
  }
}

async function listEvents(req, res) {
  try {
    const events = await all('SELECT * FROM events ORDER BY created_at DESC LIMIT 50');
    return res.json({ events });
  } catch (error) {
    return res.status(500).json({ message: 'Unable to fetch events', error: error.message });
  }
}

module.exports = {
  handleGiteaWebhook,
  listEvents,
};
