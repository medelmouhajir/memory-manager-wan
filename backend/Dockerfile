FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci

COPY . .
RUN npm run -w packages/shared build && npm run -w backend build

FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000
ENV VAULT_ROOT=/data/vault
ENV API_BASE=/api/v1/vault
ENV LOG_LEVEL=info

COPY package*.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci --omit=dev

COPY --from=build /app/backend/dist ./backend/dist
COPY --from=build /app/packages/shared/dist ./packages/shared/dist

VOLUME ["/data/vault"]
EXPOSE 4000
CMD ["node", "backend/dist/backend/src/index.js"]
