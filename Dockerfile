# syntax=docker/dockerfile:1.7
# Hearthly — citizen / agent / admin SPA + Express + Socket.IO + MQTT broker.
# Same source as Vercel; Vercel auto-deploys are unaffected.

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --no-audit --no-fund

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3030 \
    MQTT_PORT=1883
RUN addgroup -g 1001 -S nodejs && adduser -S hearthly -u 1001 -G nodejs
COPY --from=deps --chown=hearthly:nodejs /app/node_modules ./node_modules
COPY --chown=hearthly:nodejs package.json ./
COPY --chown=hearthly:nodejs src ./src
COPY --chown=hearthly:nodejs public ./public
USER hearthly
EXPOSE 3030 1883
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3030/api/health || exit 1
CMD ["node", "src/server.js"]
