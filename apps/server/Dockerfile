FROM node:20-alpine AS base

# Prisma requires OpenSSL at install/generate time.
RUN apk add --no-cache openssl

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --only=production --ignore-scripts && \
    cp -R node_modules /tmp/prod_node_modules && \
    npm ci --ignore-scripts

# Generate Prisma client
FROM base AS prisma
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY prisma ./prisma
RUN npx prisma generate

# Build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=prisma /app/node_modules/.prisma ./node_modules/.prisma
COPY . .
RUN npm run build

# Production
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 expressjs

COPY --from=builder --chown=expressjs:nodejs /app/dist ./dist
COPY --from=prisma --chown=expressjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=deps --chown=expressjs:nodejs /tmp/prod_node_modules ./node_modules
COPY --chown=expressjs:nodejs prisma ./prisma
COPY --chown=expressjs:nodejs package.json ./

# Winston writes log files under /app/logs in production.
RUN mkdir -p /app/logs && chown -R expressjs:nodejs /app/logs

USER expressjs
EXPOSE 3001

CMD ["node", "dist/index.js"]
