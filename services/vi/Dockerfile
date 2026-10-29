# The build context is the vendor/vi submodule, which has no Dockerfile of its own.
FROM node:24-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && npm install -g pnpm@12.5.1
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# The store is a build cache, so a changed lockfile only downloads what is new.
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
  pnpm install --frozen-lockfile --ignore-scripts
COPY . .
# Production build: Nuxt writes a self-contained server to .output/, which already allows .ts.net hosts.
RUN pnpm run build
# The video library is mounted here; vi.config.ts reads ./example.
VOLUME /app/example
EXPOSE 5656
ENV HOST=0.0.0.0 PORT=5656
CMD ["node", ".output/server/index.mjs"]
