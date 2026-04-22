# --- builder ----------------------------------------------------------------
FROM node:22-bookworm-slim AS builder
WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile || pnpm install

COPY tsconfig.json ./
COPY prisma ./prisma
COPY src ./src

RUN pnpm exec prisma generate
RUN pnpm run build

# Copy the prisma CLI binary before pruning devDependencies
RUN cp -a node_modules/prisma node_modules/.prisma-cli-backup \
    && cp -a node_modules/.bin/prisma node_modules/.prisma-bin-backup
RUN pnpm prune --prod
# Restore prisma CLI into prod node_modules (needed for migrate deploy at startup)
RUN mv node_modules/.prisma-cli-backup node_modules/prisma \
    && mkdir -p node_modules/.bin \
    && mv node_modules/.prisma-bin-backup node_modules/.bin/prisma

# --- runtime ----------------------------------------------------------------
FROM node:22-bookworm-slim
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist         ./dist
COPY --from=builder /app/prisma       ./prisma
COPY --from=builder /app/package.json ./

# Generate RS256 JWT key pair at build time
RUN mkdir -p ./secrets \
    && openssl genpkey -algorithm RSA -out ./secrets/jwt_private.pem -pkeyopt rsa_keygen_bits:2048 \
    && openssl rsa -pubout -in ./secrets/jwt_private.pem -out ./secrets/jwt_public.pem

COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

# --- Environment variables baked into the image ---
ENV NODE_ENV=production
ENV PORT=8080

# JWT key paths (keys are baked in above)
ENV JWT_PRIVATE_KEY_PATH=./secrets/jwt_private.pem
ENV JWT_PUBLIC_KEY_PATH=./secrets/jwt_public.pem

# Session & CSRF secrets (generated at build time — override at runtime if needed)
ENV SESSION_SECRET=production-session-secret-change-me-32chars!!
ENV CSRF_SECRET=production-csrf-secret-change-me-at-32chars!!

# Cookie & CORS defaults (override at runtime for your domain)
ENV CORS_ORIGINS=*
ENV FRONTEND_URL=http://localhost:3000
ENV COOKIE_DOMAIN=
ENV COOKIE_SECURE=true

# Token TTLs
ENV ACCESS_TOKEN_TTL_SEC=900
ENV REFRESH_TOKEN_TTL_SEC=2592000

# DATABASE_URL and REDIS_URL must be provided at runtime:
#   docker run -e DATABASE_URL=... -e REDIS_URL=... prescription-api
# Leaving them unset so the app fails fast if forgotten.

EXPOSE 8080

ENTRYPOINT ["./entrypoint.sh"]
