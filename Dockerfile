# NEXUS server image (web app + API + statistics aggregator). Built by deploy/install.sh.
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates tzdata && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1 NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json* ./
COPY prisma ./prisma
RUN npm install --no-audit --no-fund

COPY . .
RUN mkdir -p public data \
 && npm run build \
 && cp -r .next/static .next/standalone/.next/static \
 && cp -r public .next/standalone/public \
 && cp -r data .next/standalone/data

ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXUS_DATA_DIR=/data
EXPOSE 3000
CMD ["sh", "-c", "npx prisma db push --skip-generate && node .next/standalone/server.js"]
