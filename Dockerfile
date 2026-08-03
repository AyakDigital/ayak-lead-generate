# syntax=docker/dockerfile:1
# ---------------------------------------------------------------------------
# AYAK Lead Collector — dashboard image.
# Everything here runs on your laptop only — no registry push, no remote
# deploy. Two ways to use this file:
#   - `docker compose up`               -> builds the `dev` stage (hot reload,
#                                          source bind-mounted, dev deps kept)
#   - `docker build . && docker run …`  -> builds the final `runtime` stage
#                                          below (default target), a lean
#                                          single-service image with the
#                                          built frontend + API on one port.
# ---------------------------------------------------------------------------

# ---- deps: full install (root + frontend workspace), cache-friendly -------
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/package.json
RUN npm ci

# ---- dev: hot-reload target used by docker-compose.yml --------------------
# Deliberately keeps devDependencies (vite, concurrently) — dev mode can't
# run without them. Source is bind-mounted over this by compose; the COPY
# here just makes `docker build --target dev` usable standalone too.
FROM deps AS dev
WORKDIR /app
RUN addgroup -g 1001 app && adduser -D -u 1001 -G app app \
  && chown -R app:app /app
COPY . .
USER app
EXPOSE 3001 5173
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1
CMD ["npm", "run", "dev"]

# ---- build: compiles the React frontend (Vite build) -----------------------
FROM deps AS build
WORKDIR /app
COPY . .
RUN npm run build

# ---- prod-deps: root production dependencies ONLY (no frontend workspace,--
# ---- no devDependencies) — kept as its own stage so it doesn't get --------
# ---- invalidated by frontend/backend source changes. ----------------------
FROM node:20-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json ./
# Drop the workspaces field for this install only: the runtime image never
# needs frontend/node_modules (React is already bundled into frontend/dist
# by the build stage), just the 4 root deps (express, exceljs, dotenv, axios).
RUN npm pkg delete workspaces && npm ci --omit=dev --omit=optional

# ---- runtime: final image (default build target) --------------------------
FROM node:20-alpine AS runtime
WORKDIR /app

RUN addgroup -g 1001 app && adduser -D -u 1001 -G app app

COPY --from=prod-deps /app/node_modules ./node_modules
COPY package.json ./
COPY --from=build /app/frontend/dist ./frontend/dist
COPY backend ./backend
COPY config.js placesApi.js dedupe.js excelWriter.js runner.js ./
COPY AYAK_Prospects_Tetouan_VIDE.xlsx ./

RUN chown -R app:app /app
USER app

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "backend/server.js"]
