# The hub stub runs on the shared dev-base (services/dev-base) like paseo, so both reuse the same layers.
FROM dev-base
# `pnpm build` writes the bundle to services/hub/dist, which is this build context.
COPY dist/hub.mjs /app/hub.mjs
EXPOSE 8100
# dev-base checks paseo's port, which nothing listens on here.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD bash -c 'exec 3<>/dev/tcp/127.0.0.1/8100'
# The dev-base entrypoint runs this as the paseo user.
CMD ["node", "/app/hub.mjs"]
