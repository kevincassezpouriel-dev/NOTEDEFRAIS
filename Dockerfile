# --- Étape 1 : dépendances + build ---
FROM node:22-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm ci

COPY . .
# DATABASE_URL factice : nécessaire à `prisma generate`, pas au build Next
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
# Le mode standalone (server.js autonome) n'est activé que pour Docker
ENV DOCKER_BUILD=1
RUN npm run build

# --- Étape 2 : image d'exécution minimale ---
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -S app && adduser -S app -G app

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.bin/prisma ./node_modules/.bin/prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

USER app
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0

# Applique le schéma à la base au démarrage puis lance le serveur
CMD ["sh", "-c", "./node_modules/.bin/prisma db push --skip-generate && node server.js"]
