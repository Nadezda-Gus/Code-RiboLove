// Обновляет красный кружок на иконке корзины.
function updateCartBadge(count) {
    var badge = document.getElementById('cart-badge');
    if (!badge) return;
    if (count > 0) {
        badge.textContent = count;
        badge.style.display = 'inline-block';
    } else {
        badge.style.display = 'none';
    }
}

// При загрузке страницы сразу тянем актуальное число товаров из сессии.
document.addEventListener('DOMContentLoaded', function () {
    fetch('/api/cart/count')
        .then(function (r) { return r.json(); })
        .then(function (d) { updateCartBadge(d.cart_count); })
        .catch(function (e) { console.error('cart count error:', e); });
});

// Добавить товар в корзину.
function addToCart(productId, btn) {
    fetch('/api/cart/add/' + productId, { method: 'POST' })
        .then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.json();
        })
        .then(function (result) {
            if (result.status !== 'success') return;

            // Меняем текст и цвет кнопки на 1 секунду
            var original = btn.innerText;
            btn.innerText = 'Добавлено';
            btn.style.background = '#28a745';
            setTimeout(function () {
                btn.innerText = original;
                btn.style.background = '#6a0dad';
            }, 1000);

            // Обновляем значок корзины на новое число
            updateCartBadge(result.cart_count);
        })
        .catch(function (e) { console.error('Ошибка:', e); });
}