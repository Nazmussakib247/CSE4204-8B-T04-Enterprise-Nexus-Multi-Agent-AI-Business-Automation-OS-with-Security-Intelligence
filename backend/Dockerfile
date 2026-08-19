# ── Build stage ───────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
# Use `npm install` rather than `npm ci` so the build is resilient to minor
# package-lock drift. Falls back to a lockfile refresh when needed.
RUN npm install --omit=dev --no-audit --no-fund

# ── Runtime stage ─────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY . .

EXPOSE 5000

CMD ["node", "src/server.js"]
