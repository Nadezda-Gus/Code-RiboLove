const express = require("express");
const admin = require("firebase-admin");
const { getDb } = require("../db");
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
        const decodedToken = await admin.auth().verifyIdToken(token);
        const userProfile = await getOrCreateUserProfile(decodedToken.uid, decodedToken.email);

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

// Регистрация (устанавливает ник и город; email/created_at уже из getOrCreateUserProfile)
router.post("/api/auth/register", async (req, res) => {
    const { token, nickname, city } = req.body;
    if (!token || !nickname) {
        return res.status(400).json({ error: "Токен или никнейм не переданы" });
    }

    try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        const db = getDb();

        await db.collection("users").doc(decodedToken.uid).set(
            {
                displayName: nickname.trim(),
                city: (city || "").trim() || null,
                role: "user",
            },
            { merge: true }
        );

        res.json({ status: "success" });
    } catch (error) {
        console.error("Ошибка регистрации:", error);
        res.status(500).json({ error: "Не удалось создать профиль" });
    }
});

// Выход
router.post("/api/auth/logout", (req, res) => {
    req.session = null;
    res.json({ status: "success" });
});

// Текущий пользователь
router.get("/api/auth/me", (req, res) => {
    if (req.session.user) {
        res.json({ user: req.session.user });
    } else {
        res.json({ user: null });
    }
});

module.exports = router;