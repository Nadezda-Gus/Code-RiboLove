require("dotenv").config();

const path = require("path");
const express = require("express");
const cookieSession = require("cookie-session");
const expressLayouts = require("express-ejs-layouts");

const { initDb } = require("./db");

initDb();

const app = express();

if (!process.env.SECRET_KEY) {
  console.error("SECRET_KEY не задан в .env");
  process.exit(1);
}

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "..", "views"));
app.use(expressLayouts);
app.set("layout", "base");

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(
  cookieSession({
    name: "session",
    secret: process.env.SECRET_KEY,
    maxAge: 30 * 24 * 60 * 60 * 1000,
    sameSite: "lax",
    httpOnly: true,
  })
);

app.use("/static", express.static(path.join(__dirname, "..", "public")));

// 1. СНАЧАЛА прокидываем переменные в шаблоны (счетчик корзины и текущего юзера)
app.use((req, res, next) => {
  const cart = req.session.cart || {};
  res.locals.cartCount = Object.values(cart).reduce((a, b) => a + b, 0);
  res.locals.currentUser = req.session.user || null;
  next();
});

// 2. ПОДКЛЮЧАЕМ ВСЕ РОУТЫ
app.use(require("./routes/auth")); // <-- ОБЯЗАТЕЛЬНО ДО 404
app.use(require("./routes/pages"));
app.use(require("./routes/cart"));
app.use(require("./routes/spots"));
app.use(require("./routes/posts"));

// 3. Обработка 404 (должна быть в самом конце, перед ошибками)
app.use((req, res) => {
  res.status(404).render("404", { title: "Не найдено" });
});

// 4. Обработка ошибок
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Internal error" });
});

const PORT = Number(process.env.PORT) || 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`FishLove на http://0.0.0.0:${PORT}`);
});