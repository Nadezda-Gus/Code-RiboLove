const admin = require("firebase-admin");
const { getDb } = require("./db");

async function getOrCreateUserProfile(uid, email) {
    const db = getDb();
    if (!db) return null;

    const userRef = db.collection("users").doc(uid);
    const doc = await userRef.get();

    if (!doc.exists) {
        const newUser = {
            email: email,
            displayName: email.split("@")[0],
            city: null,
            role: "user",
            created_at: admin.firestore.FieldValue.serverTimestamp(),
        };
        await userRef.set(newUser);
        return { uid, ...newUser };
    }
    return { uid, ...doc.data() };
}

module.exports = { requireAuth, getOrCreateUserProfile };