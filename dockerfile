# --- ЭТАП 1: Сборка CSS (Builder) ---
FROM node:20-alpine AS css
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tailwind.config.js ./
COPY src/input.css ./src/input.css
COPY views ./views
COPY public ./public
RUN npx tailwindcss -i ./src/input.css -o ./public/css/style.css --minify

# --- ЭТАП 2: Продакшен (Production) ---
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

# Копируем только production-зависимости
COPY package*.json ./
RUN npm ci --omit=dev

# Копируем исходный код и шаблоны
COPY src ./src
COPY views ./views

# Копируем собранную статику из первого этапа
COPY --from=css /app/public ./public

# Создаем папку для загрузок и даем права пользователю node (встроен в alpine)
RUN mkdir -p public/uploads/posts && chown -R node:node public/uploads

# Переключаемся на непривилегированного пользователя
USER node

EXPOSE 5000
CMD ["node", "src/server.js"]