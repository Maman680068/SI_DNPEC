# syntax=docker/dockerfile:1
# Image du frontend Next.js (socle N6). Contexte : racine du dépôt.
#   docker build -f apps/web/Dockerfile --build-arg NEXT_PUBLIC_API_BASE_URL=https://api.exemple -t dnpec-web .
#   docker run -p 3100:3100 -e API_BASE_URL=https://api.exemple dnpec-web
# NEXT_PUBLIC_API_BASE_URL est intégrée au bundle à la construction ; API_BASE_URL est lue à l'exécution.
FROM node:22-bookworm-slim AS construction
RUN corepack enable
WORKDIR /app
ARG NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL NEXT_TELEMETRY_DISABLED=1
COPY . .
# Certificat d'autorité facultatif (proxy d'entreprise) : --secret id=ca,src=<fichier.crt>.
RUN --mount=type=secret,id=ca,required=false \
    if [ -f /run/secrets/ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/ca; fi \
 && pnpm install --frozen-lockfile --filter @dnpec/web... \
 && pnpm --filter @dnpec/web run build

FROM node:22-bookworm-slim
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3100
WORKDIR /app
COPY --from=construction --chown=node:node /app/node_modules ./node_modules
COPY --from=construction --chown=node:node /app/apps/web ./apps/web
USER node
WORKDIR /app/apps/web
EXPOSE 3100
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3100)+'/api/version').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["sh", "-c", "exec node_modules/.bin/next start -p ${PORT}"]
