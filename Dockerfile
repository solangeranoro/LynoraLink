# ---------------------------------------------------------------------------
# LynoraLink — Dockerfile (multi-stage) pour déploiement Render / self-host
# ---------------------------------------------------------------------------
FROM node:20-slim AS base
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# --- Dependencies ---
FROM base AS deps
COPY package.json package-lock.json* ./
COPY frontend/package.json ./frontend/package.json
COPY backend/package.json ./backend/package.json
COPY backend/prisma ./backend/prisma
RUN npm ci

# --- Builder ---
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate --schema backend/prisma/schema.prisma && npm run build

# --- Runner ---
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=builder /app/frontend ./frontend
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/backend/package.json ./backend/package.json
COPY --from=builder /app/backend/prisma ./backend/prisma
EXPOSE 3000
CMD ["npm", "run", "start"]
