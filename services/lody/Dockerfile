# Lody's daemon on the toolchain it shares with paseo; the lody CLI itself is installed in dev-base.
FROM dev-base

# The dev-base entrypoint runs this as the paseo user, after installing the skills and importing the key.
COPY lody-run /usr/local/bin/lody-run
RUN chmod +x /usr/local/bin/lody-run

# Lody only connects outward, so there is no port to probe; dev-base checks paseo's.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD pgrep -f 'lody start' > /dev/null
CMD ["lody-run"]
