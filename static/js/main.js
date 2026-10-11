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

document.addEventListener('DOMContentLoaded', function () {
    fetch('/api/cart/count')
        .then(function (r) { return r.json(); })
        .then(function (d) { updateCartBadge(d.cart_count); })
        .catch(function (e) { console.error('cart count error:', e); });
});

function addToCart(productId, btn) {
    fetch('/api/cart/add/' + productId, { method: 'POST' })
        .then(function (r) { return r.json(); })
        .then(function (result) {
            if (result.status !== 'success') return;
            var original = btn.innerText;
            btn.innerText = 'Добавлено';
            btn.style.background = '#28a745';
            setTimeout(function () {
                btn.innerText = original;
                btn.style.background = '#6a0dad';
            }, 1000);
            updateCartBadge(result.cart_count);
        })
        .catch(function (e) { console.error('Ошибка:', e); });
}