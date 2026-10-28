const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

let db = null;

function initDb() {
  const keyPath = process.env.FIREBASE_KEY_PATH || "./firebase_key.json";
  const abs = path.resolve(keyPath);

  if (!fs.existsSync(abs)) {
    console.warn(`[db] Файл ${abs} не найден. Работаем без БД.`);
    return null;
  }

  try {
    const serviceAccount = require(abs);
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }
    db = admin.firestore();
    console.log("[db] Firebase подключён");
    return db;
  } catch (e) {
    console.error("[db] Ошибка подключения к Firebase:", e);
    return null;
  }
}

function getDb() {
  return db;
}

module.exports = { initDb, getDb };