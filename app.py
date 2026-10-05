from flask import Flask, render_template, request, jsonify
import firebase_admin
from firebase_admin import credentials, firestore
import os
from dotenv import load_dotenv

load_dotenv()
app = Flask(__name__)
firebase_key_path = os.getenv('FIREBASE_KEY_PATH', 'firebase_key.json')

try:
    if os.path.exists(firebase_key_path):
        cred = credentials.Certificate(firebase_key_path)
        firebase_admin.initialize_app(cred)
        db = firestore.client()
        print("Firebase подключён")
    else:
        print(f"Файл {firebase_key_path} не найден. Работаем без БД.")
        db = None
except Exception as e:
    print(f"Ошибка подключения к Firebase: {e}")
    db = None

app.secret_key = os.getenv('SECRET_KEY', 'default-secret-for-dev')

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/catalog')
def catalog():
    if db is None:
        return render_template('catalog.html', products=[])
    try:
        products_ref = db.collection('products').stream()
        products = []
        for doc in products_ref:
            data = doc.to_dict()
            data['id'] = doc.id
            products.append(data)
        return render_template('catalog.html', products=products)
    except Exception as e:
        print(f"Ошибка чтения из Firestore: {e}")
        return render_template('catalog.html', products=[])

@app.route('/api/spots')
def get_spots():
    if db is None:
        return jsonify([])
    try:
        spots_ref = db.collection('fishing_spots').stream()
        spots = []
        for doc in spots_ref:
            data = doc.to_dict()
            spots.append({
                "id": doc.id,
                "name": data.get('name', 'Без названия'),
                "lat": data.get('latitude', 0),
                "lng": data.get('longitude', 0)
            })
        return jsonify(spots)
    except Exception as e:
        print(f"Ошибка чтения из Firestore: {e}")
        return jsonify([])

@app.route('/cart')
def cart():
    return "<h1>Корзина (в разработке)</h1><a href='/'>На главную</a>"

@app.route('/profile')
def profile():
    return "<h1>Профиль (в разработке)</h1><a href='/'>На главную</a>"

@app.route('/map')
def map_page():
    return render_template('map.html')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)