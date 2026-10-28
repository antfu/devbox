# The build context is the vendor/vi submodule, which has no Dockerfile of its own.
FROM node:24-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && npm install -g pnpm@12.5.1
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY . .
# The video library is mounted here; gallery.config.ts reads ./example.
VOLUME /app/example
EXPOSE 5656
CMD ["pnpm", "dev:lan"]
