# syntax=docker/dockerfile:1

# Image de quorex-internal : un seul processus Node qui sert l'API et le front.
# Base Debian 13 (trixie), comme le VPS.

# ---------------------------------------------------------------- construction
FROM node:20-trixie-slim AS builder

# better-sqlite3 et argon2 se compilent avec node-gyp quand il n'y a pas de binaire prêt.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Les binaires pre-compiles de better-sqlite3 et argon2 ne conviennent pas a
# toutes les machines : on compile sur place, avec la chaine installee ci-dessus.
ENV npm_config_build_from_source=true

# Les manifestes d'abord : la couche npm ci est réutilisée tant qu'ils ne bougent pas.
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci

COPY tsconfig.base.json ./
COPY shared/ shared/
COPY server/ server/
COPY client/ client/

RUN npm run build

# Les outils de construction ne partent pas en production.
RUN npm prune --omit=dev

# ------------------------------------------------------------------- exécution
FROM node:20-trixie-slim AS runtime

# tar sert au script de sauvegarde.
RUN apt-get update \
  && apt-get install -y --no-install-recommends tar \
  && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/shared/package.json ./shared/package.json
COPY --from=builder /app/shared/dist ./shared/dist
COPY --from=builder /app/server/package.json ./server/package.json
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/migrations ./server/migrations

# Base, documents et sauvegardes vivent sur un volume, jamais dans l'image.
RUN mkdir -p /var/lib/quorex-internal/data \
             /var/lib/quorex-internal/documents \
             /var/lib/quorex-internal/backups \
  && chown -R node:node /var/lib/quorex-internal \
  && chmod 700 /var/lib/quorex-internal/documents

USER node

EXPOSE 4317

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 4317) + '/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "server/dist/index.js"]
