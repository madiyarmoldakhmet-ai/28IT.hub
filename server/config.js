const path = require('path');

module.exports = {
  PORT: process.env.PORT || 3000,
  JWT_SECRET: process.env.JWT_SECRET || 'local-messenger-secret-change-me',
  DB_PATH: process.env.DB_PATH || path.join(__dirname, 'db', 'app.db'),
};
