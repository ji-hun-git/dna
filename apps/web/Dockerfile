# syntax=docker/dockerfile:1.7

FROM node:24.20.0-bookworm-slim@sha256:ba849c60be29959425b8734d57b8b4b7d56f98edd9504c9af091d5281095a71e AS build
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
WORKDIR /workspace

RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --dir apps/web build

FROM node:24.20.0-bookworm-slim@sha256:ba849c60be29959425b8734d57b8b4b7d56f98edd9504c9af091d5281095a71e AS runtime
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
WORKDIR /app

COPY --from=build --chown=node:node /workspace/apps/web/.next/standalone/ ./
COPY --from=build --chown=node:node /workspace/apps/web/.next/static/ ./apps/web/.next/static/

USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
