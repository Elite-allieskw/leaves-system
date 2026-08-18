# Builds the Leaves backend for Fly.io. Single build stage, reused wholesale
# for runtime (including devDependencies) — this app is small and runs on a
# single always-on instance, so the extra ~50-100MB of devDependencies in the
# image isn't worth a second, more fragile install pass to trim. The `prisma`
# CLI (a devDependency) needs to be present at runtime anyway, since fly.toml's
# release_command runs `npx prisma migrate deploy` before each new version
# goes live.
FROM node:20-alpine AS build
WORKDIR /app

# Prisma's query/schema engine binaries link against OpenSSL, which
# node:*-alpine doesn't ship by default (confirmed via a live
# "Could not parse schema engine response" failure on Fly, Aug 2026) —
# without this, `prisma generate`/`migrate` fail on Alpine.
RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm install

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

# Same reason as the build stage — release_command runs `prisma migrate
# deploy` inside this runtime image too, and the app itself needs it for
# every query the Prisma Client makes.
RUN apk add --no-cache openssl

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/dist ./dist
COPY package*.json ./

# Matches the default in src/index.ts (process.env.PORT || 4000) and
# fly.toml's [http_service] internal_port.
EXPOSE 4000

CMD ["node", "dist/index.js"]
