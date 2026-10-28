const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const multer = require("multer");

const POSTS_UPLOAD_DIR = path.join(__dirname, "..", "public", "uploads", "posts");
fs.mkdirSync(POSTS_UPLOAD_DIR, { recursive: true });

const ALLOWED_EXT = new Set(["png", "jpg", "jpeg", "gif", "webp"]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, POSTS_UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().slice(1);
    const base = path
      .basename(file.originalname, path.extname(file.originalname))
      .replace(/[^\w.\-]+/g, "_")
      .slice(0, 40) || "img";
    const uniq = crypto.randomBytes(4).toString("hex");
    cb(null, `${base}_${uniq}.${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().slice(1);
    if (!ALLOWED_EXT.has(ext)) {
      return cb(new Error("Разрешены только png, jpg, jpeg, gif, webp"));
    }
    cb(null, true);
  },
});

module.exports = { upload, POSTS_UPLOAD_DIR };