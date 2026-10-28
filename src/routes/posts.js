const express = require("express");
const path = require("path");
const fs = require("fs");
const admin = require("firebase-admin");

const { getDb } = require("../db");
const { upload, POSTS_UPLOAD_DIR } = require("../upload");
const { requireAuth } = require("../auth");

const router = express.Router();

// Создание поста (только для авторизованных)
router.post(
  "/add_post",
  requireAuth,
  (req, res, next) => {
    if (!getDb()) return res.status(503).json({ error: "Database unavailable" });
    next();
  },
  (req, res, next) => {
    upload.single("image")(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message });
      next();
    });
  },
  async (req, res) => {
    const db = getDb();
    const title = (req.body.title || "").trim();
    const content = (req.body.content || "").trim();

    if (!title || !content) {
      return res.status(400).json({ error: "Заполни все поля" });
    }

    let imageUrl = "";
    if (req.file) {
      imageUrl = `/static/uploads/posts/${req.file.filename}`;
    }

    try {
      const ref = await db.collection("posts").add({
        title,
        content,
        image_url: imageUrl,
        // Теперь пишем реального автора
        authorId: req.session.user.uid,
        authorName: req.session.user.displayName,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      });
      res.status(201).json({
        status: "success",
        image_url: imageUrl,
        id: ref.id,
        authorName: req.session.user.displayName,
      });
    } catch (e) {
      console.error("Ошибка записи поста:", e);
      res.status(500).json({ error: "Write failed" });
    }
  }
);

// Удаление поста (только для автора)
router.delete("/api/posts/:postId", requireAuth, async (req, res) => {
  const db = getDb();
  if (!db) return res.status(503).json({ error: "Database unavailable" });

  const { postId } = req.params;
  try {
    const ref = db.collection("posts").doc(postId);
    const doc = await ref.get();
    
    if (!doc.exists) return res.status(404).json({ error: "Пост не найден" });

    const data = doc.data();

    // ПРОВЕРКА: Удалять может только автор!
    if (data.authorId !== req.session.user.uid) {
      return res.status(403).json({ error: "Вы не можете удалить чужой пост" });
    }

    const imageUrl = data.image_url || "";
    await ref.delete();

    if (imageUrl.startsWith("/static/uploads/posts/")) {
      const filename = path.basename(imageUrl);
      const filePath = path.join(POSTS_UPLOAD_DIR, filename);
      try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch (e) {
        console.error("Не удалось удалить файл", filePath, e);
      }
    }

    res.json({ status: "success" });
  } catch (e) {
    console.error("Ошибка удаления поста:", e);
    res.status(500).json({ error: "Delete failed" });
  }
});

module.exports = router;