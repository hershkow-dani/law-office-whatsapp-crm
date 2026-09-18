# ---- build ----
# bookworm (glibc), not alpine: better-sqlite3's prebuild-install has solid
# glibc x64/arm64 prebuilt binaries, so no compiler is needed in either stage.
FROM node:20-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- runtime ----
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist

# SQLite lives here (see DB_PATH in src/db.ts) — mount a volume at this path
# so data survives container restarts/redeploys.
RUN mkdir -p /app/data
VOLUME ["/app/data"]

EXPOSE 3001
CMD ["node", "dist/index.js"]
