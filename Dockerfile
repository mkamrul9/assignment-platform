FROM node:22.18.0-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/api/prisma apps/api/prisma
COPY apps/api/prisma.config.ts apps/api/prisma.config.ts

RUN npm ci --include=dev

COPY . .

RUN npm run db:generate \
  && npm run build --workspace=@reviewdock/api \
  && npm run build --workspace=@reviewdock/web

ENV NODE_ENV=production
ENV DEMO_MODE=1
ENV TRUST_PROXY=1
ENV HOSTNAME=0.0.0.0
ENV WEB_ORIGINS=*

EXPOSE 3000

CMD ["node", "scripts/start-hosted.mjs"]
