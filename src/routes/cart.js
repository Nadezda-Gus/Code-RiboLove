const express = require("express");
const router = express.Router();

function count(cart) {
  return Object.values(cart || {}).reduce((a, b) => a + b, 0);
}

router.get("/api/cart/count", (req, res) => {
  res.json({ cart_count: count(req.session.cart) });
});

router.post("/api/cart/add/:productId", (req, res) => {
  const { productId } = req.params;
  const cart = req.session.cart || {};
  cart[productId] = (cart[productId] || 0) + 1;
  req.session.cart = cart;
  res.json({ status: "success", cart_count: count(cart) });
});

router.post("/api/cart/remove/:productId", (req, res) => {
  const { productId } = req.params;
  const cart = req.session.cart || {};
  if (cart[productId]) {
    cart[productId] -= 1;
    if (cart[productId] <= 0) delete cart[productId];
  }
  req.session.cart = cart;
  res.json({ status: "success", cart_count: count(cart) });
});

router.post("/api/cart/clear", (req, res) => {
  req.session.cart = {};
  res.json({ status: "success", cart_count: 0 });
});

module.exports = router;