FROM node:20-alpine AS css
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tailwind.config.js ./
COPY src/input.css ./src/input.css
COPY views ./views
COPY public ./public
RUN npx tailwindcss -i ./src/input.css -o ./public/css/style.css --minify

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY views ./views
COPY --from=css /app/public ./public
EXPOSE 5000
CMD ["node", "src/server.js"]