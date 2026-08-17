const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(__dirname, '../../uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
  },
});

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Разрешены только изображения: jpg, png, gif, webp'));
    }
  },
});

// POST /api/upload
async function handleUpload(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Файл не выбран или имеет неверный тип' });
    }
    const url = `/uploads/${req.file.filename}`;
    return res.status(201).json({ url });
  } catch (err) {
    console.error('handleUpload error:', err);
    return res.status(500).json({ message: 'Ошибка загрузки файла' });
  }
}

module.exports = { upload, handleUpload };
