const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const UPLOAD_DIR = path.join(__dirname, '../public/uploads/events');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Whitelist by MIME type (checked in fileFilter) and by extension (used for
// the generated filename) — never trust the client-supplied filename or
// extension directly.
const ALLOWED_MIME_TYPES = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = ALLOWED_MIME_TYPES[file.mimetype] || path.extname(file.originalname);
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

function fileFilter(req, file, cb) {
  if (!ALLOWED_MIME_TYPES[file.mimetype]) {
    return cb(new Error('Only JPEG, PNG, or WEBP images are allowed.'));
  }
  cb(null, true);
}

const bannerUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
}).single('banner');

// Wraps multer so its errors flow into the same graceful re-render path as
// express-validator errors (see controllers/web/adminEventController.js)
// instead of falling through to the generic 500 error handler.
function uploadEventBanner(req, res, next) {
  bannerUpload(req, res, (err) => {
    if (err) {
      req.uploadError =
        err.code === 'LIMIT_FILE_SIZE'
          ? 'Banner image must be smaller than 2MB.'
          : err.message || 'Banner upload failed.';
    }
    next();
  });
}

module.exports = { uploadEventBanner };
