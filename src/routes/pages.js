const express = require("express");
const { getDb } = require("../db");
const router = express.Router();

// 1. ГЛАВНАЯ
router.get("/", async (req, res) => {
    const db = getDb();
    let posts = [];
    let products = [];

    if (db) {
        try {
            // Получаем 6 последних постов
            const postsSnap = await db.collection("posts").orderBy("created_at", "desc").limit(6).get();
            postsSnap.forEach((doc) => {
                posts.push({ id: doc.id, ...doc.data() });
            });

            // Получаем 8 товаров для сетки
            const productsSnap = await db.collection("products").limit(8).get();
            productsSnap.forEach((doc) => {
                products.push({ id: doc.id, ...doc.data() });
            });
        } catch (e) {
            console.error("Ошибка загрузки данных для главной:", e);
        }
    }

    res.render("index", {
        title: "РыбаLove — снасти и сообщество рыболовов",
        description: "Купить снасти для рыбалки и пообщаться с рыболовами на РыбаLove.",
        posts,
        products
    });
});

// 2. КАТАЛОГ
router.get("/catalog", async (req, res) => {
    const db = getDb();
    const products = [];
    if (db) {
        try {
            const snap = await db.collection("products").get();
            snap.forEach((doc) => products.push({ id: doc.id, ...doc.data() }));
        } catch (e) {
            console.error("Ошибка чтения товаров:", e);
        }
    }
    res.render("catalog", {
        title: "РыбаLove — Каталог снастей",
        description: "Широкий выбор снастей для рыбалки: удочки, катушки, приманки.",
        products,
        searchQuery: null,
    });
});

// 3. КАРТОЧКА ТОВАРА
router.get("/product/:id", async (req, res) => {
    const db = getDb();
    if (!db) return res.status(503).render("404", { title: "Недоступно" });

    const { id } = req.params;
    try {
        const doc = await db.collection("products").doc(id).get();
        if (!doc.exists) {
            return res.status(404).render("404", { title: "Товар не найден" });
        }
        const product = { id: doc.id, ...doc.data() };
        res.render("product", {
            title: `${product.name} — РыбаLove`,
            description: product.description || "Товар на РыбаLove",
            product,
        });
    } catch (e) {
        console.error("Ошибка загрузки товара:", e);
        res.status(500).render("404", { title: "Ошибка" });
    }
});

// 4. ПОИСК
router.get("/search", async (req, res) => {
    const db = getDb();
    const query = (req.query.q || "").trim();
    const products = [];

    if (db && query) {
        try {
            const q = query.toLowerCase();
            const snap = await db.collection("products").get();
            snap.forEach((doc) => {
                const d = doc.data();
                const name = (d.name || "").toLowerCase();
                const desc = (d.description || "").toLowerCase();
                if (name.includes(q) || desc.includes(q)) {
                    products.push({ id: doc.id, ...d });
                }
            });
        } catch (e) {
            console.error("Ошибка поиска:", e);
        }
    }
    res.render("catalog", {
        title: query ? `Поиск: ${query} — РыбаLove` : "Поиск — РыбаLove",
        description: `Результаты поиска снастей по запросу "${query}" на РыбаLove.`,
        products,
        searchQuery: query,
        noindex: true
    });
});

// 5. КОРЗИНА
router.get("/cart", async (req, res) => {
    const db = getDb();
    const cart = req.session.cart || {};
    const items = [];
    let total = 0;

    if (db) {
        for (const [productId, quantity] of Object.entries(cart)) {
            try {
                const doc = await db.collection("products").doc(productId).get();
                if (!doc.exists) continue;
                const p = { id: doc.id, ...doc.data(), quantity };
                const price = Number(p.price) || 0;
                p.subtotal = price * quantity;
                total += p.subtotal;
                items.push(p);
            } catch (e) {
                console.error("Ошибка загрузки товара", productId, e);
            }
        }
    }
    res.render("cart", {
        title: "Корзина — РыбаLove",
        description: "Ваша корзина покупок на РыбаLove.",
        items,
        total,
        noindex: true
    });
});

// 6. ПРОФИЛЬ
router.get("/profile", (req, res) => {
    if (!req.session.user) {
        return res.redirect("/login");
    }
    res.render("profile", {
        title: `Профиль: ${req.session.user.displayName} — РыбаLove`,
        description: "Личный кабинет пользователя РыбаLove.",
        noindex: true
    });
});

// 7. КАРТА
router.get("/map", (req, res) => {
    res.render("map", {
        title: "Карта рыбных мест — РыбаLove",
        description: "Интерактивная карта рыболовных мест сообщества РыбаLove."
    });
});

// 8. ЛЕНТА ПОСТОВ
router.get("/posts", async (req, res) => {
    const db = getDb();
    const posts = [];
    if (db) {
        try {
            const snap = await db.collection("posts").orderBy("created_at", "desc").get();
            snap.forEach((doc) => {
                const d = doc.data();
                const created = d.created_at;
                let createdAt = "";
                if (created && typeof created.toDate === "function") {
                    const date = created.toDate();
                    createdAt = date.toLocaleString("ru-RU", {
                        day: "2-digit", month: "2-digit", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                    });
                }
                posts.push({ id: doc.id, ...d, created_at: createdAt });
            });
        } catch (e) {
            console.error("Ошибка чтения постов:", e);
        }
    }
    res.render("posts", {
        title: "Лента постов — РыбаLove",
        description: "Последние уловы, советы и истории от сообщества рыболовов РыбаLove.",
        posts
    });
});

module.exports = router;