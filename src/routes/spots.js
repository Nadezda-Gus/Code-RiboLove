const express = require("express");
const { getDb } = require("../db");
const router = express.Router();

// Надежный парсер строки "57.2° N, 33.1° E" или "[57.2° N, 33.1° E]"
function parseCoordinates(str) {
    if (!str) return [null, null];

    // Ищем все числа в строке (включая отрицательные и с точкой)
    const matches = [...str.matchAll(/(-?\d+(?:\.\d+)?)/g)];

    if (matches.length < 2) return [null, null];

    let lat = parseFloat(matches[0][1]);
    let lng = parseFloat(matches[1][1]);

    // Проверяем наличие букв S и W для отрицательных координат
    const upperStr = str.toUpperCase();

    // Если в строке есть S (Юг), делаем широту отрицательной
    if (upperStr.includes("S")) lat = -Math.abs(lat);
    // Если в строке есть W (Запад), делаем долготу отрицательной
    if (upperStr.includes("W")) lng = -Math.abs(lng);

    // Проверяем пределы
    if (lat < -90 || lat > 90) lat = null;
    if (lng < -180 || lng > 180) lng = null;

    return [lat, lng];
}

// ПОЛУЧЕНИЕ ВСЕХ ТОЧЕК
router.get("/api/spots", async (req, res) => {
    const db = getDb();
    if (!db) return res.json([]);

    const spots = [];
    try {
        const snap = await db.collection("fishing_spots").get();
        snap.forEach((doc) => {
            const d = doc.data();
            let lat = null;
            let lng = null;

            // 1. latitude/longitude
            if (d.latitude != null && d.longitude != null) {
                lat = d.latitude;
                lng = d.longitude;
            }
            // 2. lat/lng
            else if (d.lat != null && d.lng != null) {
                lat = d.lat;
                lng = d.lng;
            }
            // 3. GeoPoint
            else if (d.coordinates && typeof d.coordinates.latitude === "number") {
                lat = d.coordinates.latitude;
                lng = d.coordinates.longitude;
            }
            // 4. Строка (как на вашем скриншоте)
            else if (typeof d.coordinates === "string") {
                [lat, lng] = parseCoordinates(d.coordinates);
            }

            if (lat == null || lng == null) {
                console.warn(`Пропускаю ${doc.id}: не удалось распознать координаты`);
                return;
            }

            lat = Number(lat);
            lng = Number(lng);

            if (Number.isNaN(lat) || Number.isNaN(lng)) {
                console.warn(`Пропускаю ${doc.id}: координаты не являются числами`);
                return;
            }

            spots.push({
                id: doc.id,
                name: d.name || "Без названия",
                description: d.description || "",
                lat: lat,
                lng: lng,
            });
        });
    } catch (e) {
        console.error("Ошибка чтения рыбных мест:", e);
    }

    res.json(spots);
});

// ДОБАВЛЕНИЕ НОВОЙ ТОЧКИ (Этого не хватало!)
router.post("/api/spots", async (req, res) => {
    const db = getDb();
    if (!db) return res.status(503).json({ error: "Database unavailable" });

    const { name, lat, lng, description } = req.body || {};

    if (!name || lat == null || lng == null) {
        return res.status(400).json({ error: "Не переданы name, lat или lng" });
    }

    try {
        await db.collection("fishing_spots").add({
            name: name,
            latitude: Number(lat),
            longitude: Number(lng),
            description: description || "",
            author: "User",
            created_at: new Date()
        });
        res.status(201).json({ status: "success" });
    } catch (e) {
        console.error("Ошибка добавления места:", e);
        res.status(500).json({ error: "Write failed" });
    }
});

module.exports = router;