FROM node:24-slim
# `pnpm build` writes the bundle to services/hub/dist, which is this build context.
COPY dist/hub.mjs /app/hub.mjs
USER node
EXPOSE 8100
CMD ["node", "/app/hub.mjs"]
