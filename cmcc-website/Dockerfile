# syntax=docker/dockerfile:1.7
# Hearthly CMCC — operator console SPA + Express API.
# Same source as Vercel; Vercel auto-deploys are unaffected.

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --no-audit --no-fund

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=4040
RUN addgroup -g 1001 -S nodejs && adduser -S cmcc -u 1001 -G nodejs
COPY --from=deps --chown=cmcc:nodejs /app/node_modules ./node_modules
COPY --chown=cmcc:nodejs package.json server.js ./
COPY --chown=cmcc:nodejs public ./public
USER cmcc
EXPOSE 4040
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:4040/api/health || exit 1
CMD ["node", "server.js"]
