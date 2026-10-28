const express = require("express");
const admin = require("firebase-admin");
const { getOrCreateUserProfile } = require("../auth");
const router = express.Router();

// Страница логина/регистрации
router.get("/login", (req, res) => {
    if (req.session.user) return res.redirect("/posts");

    res.render("login", {
        title: "Вход и регистрация — РыбаLove",
        description: "Авторизуйтесь или создайте аккаунт, чтобы делиться своими уловами.",
        noindex: true
    });
});

// API для входа
router.post("/api/auth/login", async (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: "Токен не передан" });

    try {
        // Проверяем токен через Firebase Admin
        const decodedToken = await admin.auth().verifyIdToken(token);

        // Получаем/создаем профиль в Firestore
        const userProfile = await getOrCreateUserProfile(decodedToken.uid, decodedToken.email);

        // Сохраняем в сессию
        req.session.user = {
            uid: decodedToken.uid,
            email: decodedToken.email,
            displayName: userProfile.displayName || decodedToken.email.split("@")[0],
        };

        res.json({ status: "success", user: req.session.user });
    } catch (error) {
        console.error("Ошибка авторизации:", error);
        res.status(401).json({ error: "Неверный токен" });
    }
});

// Выход
router.post("/api/auth/logout", (req, res) => {
    req.session = null;
    res.json({ status: "success" });
});

// Получение текущего пользователя (для фронтенда)
router.get("/api/auth/me", (req, res) => {
    if (req.session.user) {
        res.json({ user: req.session.user });
    } else {
        res.json({ user: null });
    }
});

// Регистрация (создание профиля с ником)
router.post("/api/auth/register", async (req, res) => {
    const { token, nickname } = req.body;
    if (!token || !nickname) {
        return res.status(400).json({ error: "Токен или никнейм не переданы" });
    }

    try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        const db = getDb();

        await db.collection("users").doc(decodedToken.uid).set({
            email: decodedToken.email,
            displayName: nickname.trim(),
            created_at: admin.firestore.FieldValue.serverTimestamp(),
        });

        res.json({ status: "success" });
    } catch (error) {
        console.error("Ошибка регистрации:", error);
        res.status(500).json({ error: "Не удалось создать профиль" });
    }
});

module.exports = router;