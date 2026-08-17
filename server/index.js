const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const dotenv = require('dotenv');

const { PORT } = require('./config');
const { initDatabase } = require('./db/database');
const authRoutes = require('./routes/authRoutes');
const chatRoutes = require('./routes/chatRoutes');
const userRoutes = require('./routes/userRoutes');
const { setupSocket } = require('./sockets/chatSocket');
const webhookRoutes = require('./routes/webhookRoutes');
const postRoutes = require('./routes/postRoutes');
const uploadRoutes = require('./routes/uploadRoutes');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const path = require('path');

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, '../client')));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.use('/api', authRoutes);
app.use('/api', chatRoutes);
app.use('/api', userRoutes);
app.use('/api', postRoutes);
app.use('/api', uploadRoutes);

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

// Make io accessible to controllers (e.g. webhookController)
app.set('io', io);

setupSocket(io);

// Webhook route for Gitea events (raw body needed for HMAC check)
app.use('/api', webhookRoutes);

async function startServer() {
  try {
    await initDatabase();
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://0.0.0.0:${PORT}`);
    });
  } catch (error) {
    console.error('Database initialization failed:', error);
    process.exit(1);
  }
}

startServer();
