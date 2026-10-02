# syntax=docker/dockerfile:1
# Image de l'API NestJS (socle N6). Contexte : racine du dépôt.
#   docker build -f apps/api/Dockerfile -t dnpec-api .
#   docker run -p 3000:3000 -e DATABASE_URL=... -e JWT_ACCESS_SECRET=... -v documents:/var/data/documents dnpec-api
# Les migrations ne sont jamais appliquées au démarrage : elles passent par le workflow manuel
# db-migrate.yml (règle du projet). Render continue de construire sans cette image (render.yaml).
# Image complète (OpenSSL et certificats inclus, requis par Prisma) : aucun paquet système à installer.
FROM node:22-bookworm AS construction
RUN corepack enable
WORKDIR /app
COPY . .
# Certificat d'autorité facultatif (proxy d'entreprise) : --secret id=ca,src=<fichier.crt>.
RUN --mount=type=secret,id=ca,required=false \
    if [ -f /run/secrets/ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/ca; fi \
 && pnpm install --frozen-lockfile --filter @dnpec/api... \
 && pnpm --filter @dnpec/api exec prisma generate \
 && pnpm --filter @dnpec/api run build

FROM node:22-bookworm
RUN mkdir -p /var/data/documents && chown node:node /var/data/documents
ENV NODE_ENV=production DOCUMENTS_STORAGE_PATH=/var/data/documents PORT=3000
WORKDIR /app
COPY --from=construction --chown=node:node /app/node_modules ./node_modules
COPY --from=construction --chown=node:node /app/apps/api ./apps/api
USER node
WORKDIR /app/apps/api
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
