import logging
import os
import re
import uuid

from dotenv import load_dotenv
from flask import Flask, jsonify, render_template, request, session
from werkzeug.utils import secure_filename

import firebase_admin
from firebase_admin import credentials, firestore
from google.cloud.firestore_v1 import GeoPoint, Query

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

load_dotenv()
app = Flask(__name__)

# SECRET_KEY обязателен — без него приложение не поднимется
app.secret_key = os.environ["SECRET_KEY"]

# Лимит на размер загружаемого файла
MAX_CONTENT_LENGTH = 5 * 1024 * 1024
app.config["MAX_CONTENT_LENGTH"] = MAX_CONTENT_LENGTH

db = None
firebase_key_path = os.getenv("FIREBASE_KEY_PATH", "firebase_key.json")

try:
    if os.path.exists(firebase_key_path):
        cred = credentials.Certificate(firebase_key_path)
        if not firebase_admin._apps:
            firebase_admin.initialize_app(cred)
        db = firestore.client()
        logger.info("Firebase подключён")
    else:
        logger.warning("Файл %s не найден. Работаем без БД.", firebase_key_path)
except Exception:
    logger.exception("Ошибка подключения к Firebase")
    db = None

def cart_count_value():
    """Сколько всего товаров в корзине (сумма количеств)."""
    return sum(session.get("cart", {}).values())


def require_db(f):
    """Декоратор: возвращает 503, если БД недоступна."""
    from functools import wraps

    @wraps(f)
    def wrapper(*args, **kwargs):
        if db is None:
            return jsonify({"error": "Database unavailable"}), 503
        return f(*args, **kwargs)

    return wrapper


def parse_coordinates(coord_str):
    """Парсит строку вида '55.75 N, 37.61 E' в (lat, lng)."""
    if not coord_str:
        return None, None
    match = re.findall(r"(-?\d+(?:\.\d+)?)\s*°?\s*([NSEW])?", coord_str)
    if len(match) < 2:
        return None, None
    lat, lng = float(match[0][0]), float(match[1][0])
    if match[0][1] in ("S", "s"):
        lat = -lat
    if match[1][1] in ("W", "w"):
        lng = -lng
    return lat, lng

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/catalog")
def catalog():
    products = []
    if db is not None:
        try:
            for doc in db.collection("products").stream():
                data = doc.to_dict()
                data["id"] = doc.id
                products.append(data)
        except Exception:
            logger.exception("Ошибка чтения товаров из Firestore")
    return render_template("catalog.html", products=products)


@app.route("/search")
def search():
    query = (request.args.get("q") or "").strip()
    products = []

    if db is not None and query:
        try:
            q_lower = query.lower()
            for doc in db.collection("products").stream():
                data = doc.to_dict()
                name = (data.get("name") or "").lower()
                description = (data.get("description") or "").lower()
                if q_lower in name or q_lower in description:
                    data["id"] = doc.id
                    products.append(data)
        except Exception:
            logger.exception("Ошибка поиска")

    return render_template(
        "catalog.html",
        products=products,
        search_query=query,
    )


@app.route("/cart")
def cart():
    cart_data = session.get("cart", {})
    cart_items = []
    total = 0

    if db and cart_data:
        for product_id, quantity in cart_data.items():
            try:
                doc = db.collection("products").document(product_id).get()
                if not doc.exists:
                    continue
                product = doc.to_dict()
                product["id"] = doc.id
                product["quantity"] = quantity
                try:
                    price = float(product.get("price", 0))
                except (ValueError, TypeError):
                    price = 0
                product["subtotal"] = price * quantity
                total += product["subtotal"]
                cart_items.append(product)
            except Exception:
                logger.exception("Ошибка загрузки товара %s", product_id)

    return render_template("cart.html", items=cart_items, total=total)


@app.route("/profile")
def profile():
    return "<h1>Профиль (в разработке)</h1><a href='/'>На главную</a>"


@app.route("/map")
def map_page():
    return render_template("map.html")


@app.route("/posts")
def posts_page():
    posts_list = []
    if db is not None:
        try:
            for doc in (
                db.collection("posts")
                .order_by("created_at", direction=Query.DESCENDING)
                .stream()
            ):
                data = doc.to_dict()
                data["id"] = doc.id
                created = data.get("created_at")
                if created and hasattr(created, "strftime"):
                    data["created_at"] = created.strftime("%d.%m.%Y %H:%M")
                else:
                    data["created_at"] = ""
                posts_list.append(data)
        except Exception:
            logger.exception("Ошибка чтения постов")
    return render_template("posts.html", posts=posts_list)

@app.route("/api/spots")
def get_spots():
    if db is None:
        return jsonify([])

    spots = []
    try:
        for doc in db.collection("fishing_spots").stream():
            data = doc.to_dict()

            lat = None
            lng = None

            if data.get("latitude") is not None and data.get("longitude") is not None:
                lat = data["latitude"]
                lng = data["longitude"]

            coords = data.get("coordinates")
            if lat is None and isinstance(coords, GeoPoint):
                lat = coords.latitude
                lng = coords.longitude

            if lat is None and isinstance(coords, str):
                lat, lng = parse_coordinates(coords)

            if lat is None and isinstance(coords, dict):
                lat = coords.get("lat") or coords.get("latitude")
                lng = coords.get("lng") or coords.get("longitude")

            if lat is None or lng is None:
                logger.warning("Пропускаю точку %s: нет координат", doc.id)
                continue

            try:
                lat = float(lat)
                lng = float(lng)
            except (TypeError, ValueError):
                logger.warning("Пропускаю точку %s: битые координаты", doc.id)
                continue

            spots.append({
                "id": doc.id,
                "name": data.get("name", "Без названия"),
                "description": data.get("description", ""),
                "lat": lat,
                "lng": lng,
            })
    except Exception:
        logger.exception("Ошибка чтения рыбных мест")

    return jsonify(spots)


@app.route("/api/spots", methods=["POST"])
@require_db
def add_spot():
    data = request.get_json(silent=True) or {}
    if not data.get("name") or data.get("lat") is None or data.get("lng") is None:
        return jsonify({"error": "Invalid data"}), 400

    try:
        db.collection("fishing_spots").add({
            "name": data["name"],
            "latitude": float(data["lat"]),
            "longitude": float(data["lng"]),
            "description": data.get("description", ""),
            "author": "User",
        })
    except Exception:
        logger.exception("Ошибка добавления места")
        return jsonify({"error": "Write failed"}), 500

    return jsonify({"status": "success"}), 201

@app.route("/api/cart/count")
def cart_count():
    return jsonify({"cart_count": cart_count_value()})


@app.route("/api/cart/add/<product_id>", methods=["POST"])
def add_to_cart(product_id):
    cart = session.get("cart", {})
    cart[product_id] = cart.get(product_id, 0) + 1
    session["cart"] = cart
    session.modified = True
    return jsonify({"status": "success", "cart_count": cart_count_value()})


@app.route("/api/cart/remove/<product_id>", methods=["POST"])
def remove_from_cart(product_id):
    cart = session.get("cart", {})
    if product_id in cart:
        cart[product_id] -= 1
        if cart[product_id] <= 0:
            del cart[product_id]
    session["cart"] = cart
    session.modified = True
    return jsonify({"status": "success", "cart_count": cart_count_value()})


@app.route("/api/cart/clear", methods=["POST"])
def clear_cart():
    session.pop("cart", None)
    return jsonify({"status": "success", "cart_count": 0})

# Куда сохраняем картинки постов
POSTS_UPLOAD_DIR = os.path.join("static", "uploads", "posts")
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "webp"}
os.makedirs(POSTS_UPLOAD_DIR, exist_ok=True)


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route("/add_post", methods=["POST"])
@require_db
def add_post():
    title = (request.form.get("title") or "").strip()
    content = (request.form.get("content") or "").strip()

    if not title or not content:
        return jsonify({"error": "Заполни все поля"}), 400

    # --- Сохранение картинки ---
    image_url = ""
    file = request.files.get("image")

    if file and file.filename:
        if not allowed_file(file.filename):
            return jsonify({"error": "Разрешены только png, jpg, jpeg, gif, webp"}), 400

        ext = file.filename.rsplit(".", 1)[1].lower()
        safe_name = secure_filename(file.filename.rsplit(".", 1)[0])[:40] or "img"
        unique_name = f"{safe_name}_{uuid.uuid4().hex[:8]}.{ext}"

        save_path = os.path.join(POSTS_UPLOAD_DIR, unique_name)
        file.save(save_path)

        image_url = f"/static/uploads/posts/{unique_name}"

    # --- Запись в Firestore ---
    try:
        doc_ref = db.collection("posts").add({
            "title": title,
            "content": content,
            "image_url": image_url,
            "author": "Аноним",
            "created_at": firestore.SERVER_TIMESTAMP,
        })
        # .add() возвращает (timestamp, document_id) — берём id
        _, post_id = doc_ref
    except Exception:
        logger.exception("Ошибка записи поста")
        return jsonify({"error": "Write failed"}), 500

    return jsonify({
        "status": "success",
        "image_url": image_url,
        "id": post_id,
    }), 201


@app.route("/api/posts/<post_id>", methods=["DELETE"])
@require_db
def delete_post(post_id):
    try:
        doc_ref = db.collection("posts").document(post_id)
        doc = doc_ref.get()
        if not doc.exists:
            return jsonify({"error": "Пост не найден"}), 404

        data = doc.to_dict() or {}
        image_url = data.get("image_url", "")

        # Удаляем документ из Firestore
        doc_ref.delete()

        # Если была картинка — удаляем файл с диска
        if image_url.startswith("/static/uploads/posts/"):
            filename = os.path.basename(image_url)
            file_path = os.path.join(POSTS_UPLOAD_DIR, filename)
            try:
                if os.path.exists(file_path):
                    os.remove(file_path)
            except OSError:
                logger.exception("Не удалось удалить файл %s", file_path)

        return jsonify({"status": "success"}), 200

    except Exception:
        logger.exception("Ошибка удаления поста %s", post_id)
        return jsonify({"error": "Delete failed"}), 500


if __name__ == "__main__":
    debug = os.getenv("FLASK_DEBUG", "false").lower() == "true"
    app.run(host="0.0.0.0", port=5000, debug=debug)