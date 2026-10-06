# Kimbo API image. Built from the repo root so the API can use the shared workspace package.
FROM node:24-slim
WORKDIR /app
RUN corepack enable

# Install only what the API needs (cached unless manifests change).
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/mobile/package.json apps/mobile/
RUN pnpm install --frozen-lockfile --filter @kimbo/api...

COPY packages/shared packages/shared
COPY apps/api apps/api

WORKDIR /app/apps/api
ENV NODE_ENV=production
EXPOSE 3000
CMD ["pnpm", "exec", "tsx", "src/server.ts"]
