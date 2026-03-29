FROM node:24-slim AS builder

RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN if [ -f pnpm-lock.yaml ]; then pnpm install --frozen-lockfile; else pnpm install; fi
COPY . .
RUN pnpm run build

FROM node:24-slim

RUN corepack enable
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./

EXPOSE 3000
USER node

CMD ["node", "dist/index.js"]
