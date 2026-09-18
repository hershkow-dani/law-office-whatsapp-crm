# ---- build ----
FROM node:20-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- runtime ----
# Serves the built static files and reverse-proxies /api to the server
# container (see nginx.conf) — same origin from the browser's point of view,
# exactly like the Vite dev proxy, so the session cookie just works with no
# CORS configuration needed.
FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
