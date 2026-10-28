const express = require("express");
const { getDb } = require("../db");
const router = express.Router();

router.get("/", (req, res) => {
    res.render("index", { title: "РыбаLove - Главная" });
});

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
        title: "РыбаLove - Каталог",
        products,
        searchQuery: null,
    });
});

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
        title: `Поиск: ${query}`,
        products,
        searchQuery: query,
    });
});

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
    res.render("cart", { title: "РыбаLove - Корзина", items, total });
});

router.get("/profile", (req, res) => {
    if (!req.session.user) {
        return res.redirect("/login"); // Если не вошел — отправляем на вход
    }
    res.send(`
    <div class="max-w-md mx-auto mt-20 p-8 bg-white rounded-xl shadow-sm text-center">
      <h1 class="text-2xl font-bold mb-4">Профиль: ${req.session.user.displayName}</h1>
      <p class="text-neutral-500 mb-6">${req.session.user.email}</p>
      <form action="/api/auth/logout" method="POST" id="logout-form">
        <button type="submit" class="btn-remove">Выйти из аккаунта</button>
      </form>
      <a href="/" class="block mt-4 text-fish-purple hover:underline">На главную</a>
    </div>
    <script>
      document.getElementById('logout-form').addEventListener('submit', function(e) {
        e.preventDefault();
        fetch('/api/auth/logout', { method: 'POST' })
          .then(() => window.location.href = '/');
      });
    </script>
  `);
});

router.get("/map", (req, res) => {
    res.render("map", { title: "РыбаLove - Карта" });
});

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
    res.render("posts", { title: "РыбаLove - Лента", posts });
});

module.exports = router;