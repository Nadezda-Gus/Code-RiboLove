from flask import Flask, render_template, request, jsonify
import pyodbc
import os
from dotenv import load_dotenv

load_dotenv()
app = Flask(__name__)
conn_str = (
    f"DRIVER={{ODBC Driver 17 for SQL Server}};"
    f"SERVER={os.getenv('DB_SERVER')};"
    f"DATABASE={os.getenv('DB_NAME')};"
    f"Trusted_Connection=yes;"
)

app.secret_key = os.getenv('SECRET_KEY')

def get_db_connection():
    try:
        conn = pyodbc.connect(conn_str)
        return conn
    except Exception as e:
        print(f"Ошибка подключения к БД: {e}")
        return None

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/catalog')
def catalog():
    conn = get_db_connection()
    if conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, price, image_url FROM Products")
        products = cursor.fetchall()
        conn.close()
        return render_template('catalog.html', products=products)
    return "Ошибка БД"

@app.route('/api/spots')
def get_spots():
    conn = get_db_connection()
    if conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, latitude, longitude FROM FishingSpots")
        rows = cursor.fetchall()
        spots = [{"id": row[0], "name": row[1], "lat": float(row[2]), "lng": float(row[3])} for row in rows]
        conn.close()
        return jsonify(spots)
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
    app.run(debug=True)