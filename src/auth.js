const admin = require("firebase-admin");
const { getDb } = require("./db");

// Middleware: проверяет сессию и добавляет req.user
function requireAuth(req, res, next) {
    if (!req.session.user) {
        return res.status(401).json({ error: "Необходима авторизация" });
    }
    next();
}

// Получение данных пользователя из Firestore (или создание нового)
async function getOrCreateUserProfile(uid, email) {
    const db = getDb();
    if (!db) return null;

    const userRef = db.collection("users").doc(uid);
    const doc = await userRef.get();

    if (!doc.exists) {
        const newUser = {
            email: email,
            displayName: email.split("@")[0],
            created_at: admin.firestore.FieldValue.serverTimestamp(),
        };
        await userRef.set(newUser);
        return { uid, ...newUser };
    }
    return { uid, ...doc.data() };
}

module.exports = { requireAuth, getOrCreateUserProfile };