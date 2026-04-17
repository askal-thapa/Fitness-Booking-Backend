# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build && echo "Build succeeded" && ls dist/main.js

# Stage 2: Production
FROM node:20-alpine AS production

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/drizzle ./drizzle

EXPOSE 3001

CMD ["node", "dist/main"]
