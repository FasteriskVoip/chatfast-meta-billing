# ---- build ----
FROM node:22-alpine AS build
ENV NODE_ENV=development
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build:client

# ---- runtime ----
FROM node:22-alpine
ENV NODE_ENV=production TZ=America/Fortaleza PORT=3002
RUN apk add --no-cache tzdata
WORKDIR /app
COPY --from=build /app /app
EXPOSE 3002
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD wget -qO- "http://127.0.0.1:${PORT}/health" || exit 1
CMD npx prisma migrate deploy && npm start
