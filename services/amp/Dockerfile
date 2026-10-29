# Amp's web terminal, on the toolchain it shares with paseo (the Amp CLI itself is installed in the base).
FROM containers/base

# ttyd serves a shell in the browser, and tmux keeps that shell alive between connections. Debian
# bookworm has no ttyd package, so take the static release binary.
ARG TTYD_VERSION=1.7.7
RUN apt-get update && apt-get install -y --no-install-recommends tmux \
  && rm -rf /var/lib/apt/lists/* \
  && curl -fsSL "https://github.com/tsl0922/ttyd/releases/download/${TTYD_VERSION}/ttyd.$(uname -m)" -o /usr/local/bin/ttyd \
  && chmod +x /usr/local/bin/ttyd

# The base's entrypoint runs this as the paseo user, after installing the skills and importing the key.
COPY amp-terminal /usr/local/bin/amp-terminal
RUN chmod +x /usr/local/bin/amp-terminal

EXPOSE 7681
# The base checks paseo's port, which nothing listens on here.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD bash -c 'exec 3<>/dev/tcp/127.0.0.1/7681'
CMD ["amp-terminal"]
