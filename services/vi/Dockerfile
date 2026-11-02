# The build context is the vendor/vi submodule, which has no Dockerfile of its own.
# It starts FROM dev-base (built by `pnpm build:dev-base`), so vi shares the toolchain's layers: Node, pnpm
# through jup, and the browsers. dev-base's entrypoint runs the command as the `paseo` user (uid 1000).
FROM dev-base
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*
# /app is the paseo user's, so the install and build run as that user and leave nothing root-owned behind.
RUN install -d -o paseo -g paseo /app
WORKDIR /app
USER paseo
COPY --chown=1000:1000 package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# The store is a build cache, so a changed lockfile only downloads what is new. jup's pnpm shim runs the
# version package.json pins.
ENV npm_config_store_dir=/tmp/pnpm-store
RUN --mount=type=cache,target=/tmp/pnpm-store,uid=1000,gid=1000 \
  pnpm install --frozen-lockfile --ignore-scripts
COPY --chown=1000:1000 . .
# Production build: Nuxt writes a self-contained server to .output/, which already allows .ts.net hosts.
RUN pnpm run build
# Back to root: dev-base's entrypoint needs it to import keys and then drops to paseo.
USER root
# The video library is mounted here; vi.config.ts reads ./example.
VOLUME /app/example
EXPOSE 5656
ENV HOST=0.0.0.0 PORT=5656
# dev-base checks paseo's port, which nothing listens on here. Any HTTP answer counts, as the API is
# behind the PIN and answers 401.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -sS -o /dev/null http://127.0.0.1:5656/
CMD ["node", ".output/server/index.mjs"]
