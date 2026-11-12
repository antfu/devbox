# The heavy, slow-changing toolchain under every service: system packages, jup, uv, Rust, Chromium and Chrome.
# Built as `paseo-toolchain` by `pnpm build:toolchain`, and used as the base image of paseo's own build
# (`pnpm build:paseo` passes it as upstream's NODE_IMAGE build arg), so paseo sits on top of it. Nothing here
# depends on paseo, so changing the patches or moving to a new release never rebuilds these layers. Keep it
# so: no paseo user (paseo's Dockerfile renames the image's uid 1000 user, `node`, to `paseo`, so folders
# are owned by the number 1000), and no tools that move fast, which belong in services/dev-base.
# Keep NODE_IMAGE on the tag of upstream's default in vendor/paseo/docker/base/Dockerfile, pinned to a digest:
# the tag moves with every node and Debian release, and a new base rebuilds every layer of every image, about
# 2 GB to download. Bump the digest on purpose, e.g. when moving to a new paseo release:
# `docker buildx imagetools inspect node:22-bookworm-slim` prints the current one.
ARG NODE_IMAGE=node:22-bookworm-slim@sha256:e9f565d32859f0cbfb52125eafe8be39390f24dac302dc3cdf566e8ba3ab21ee
FROM ${NODE_IMAGE}

# Layers run from the least to the most often changed, so an edit near the bottom keeps the heavy layers
# above it cached.

# One apt layer for every system package. gh comes from GitHub's apt repo, since Debian's copy is old.
# It reads the placeholder GITHUB_TOKEN, which the broker swaps for the real token on api.github.com.
# gnupg signs the agents' commits; the entrypoint imports the key on start.
# Python for the agents: pip is blocked system-wide (PEP 668), so projects use venv or uv.
# build-essential supplies the C compiler and linker that Rust and native npm modules need.
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl gnupg \
  && curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg -o /usr/share/keyrings/githubcli-archive-keyring.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" > /etc/apt/sources.list.d/github-cli.list \
  && apt-get update && apt-get install -y --no-install-recommends gh build-essential python3 python3-pip python3-venv python-is-python3 \
  && rm -rf /var/lib/apt/lists/*

# Tools that have to live outside /home/paseo, which is a host mount and hides anything installed there.
# jup manages package manager and runtime versions; its store is writable by the daemon's user.
# uv sits next to the jup shims in /usr/local/bin.
ENV JUP_HOME=/opt/jup
RUN curl -fsSL https://jup.unjs.io/install.sh | JUP_SHIM_DIRECTORY=/usr/local/bin sh \
  && mkdir -p /opt/jup && chown -R 1000:1000 /opt/jup \
  && curl -LsSf https://astral.sh/uv/install.sh | env UV_INSTALL_DIR=/usr/local/bin UV_NO_MODIFY_PATH=1 sh

# The Rust toolchain, outside /home/paseo for the same reason. The minimal profile keeps the layer small;
# clippy and rustfmt are added back. The daemon's user owns both folders, so cargo can fetch crates
# and `rustup` can add targets.
ENV RUSTUP_HOME=/opt/rustup CARGO_HOME=/opt/cargo PATH=/opt/cargo/bin:${PATH}
RUN curl -fsSL https://sh.rustup.rs | sh -s -- -y --no-modify-path --profile minimal --component clippy --component rustfmt \
  && chown -R 1000:1000 /opt/rustup /opt/cargo

# Chromium for Playwright, with the system libraries it needs, shared by every user. Google Chrome comes
# too where Google ships it (amd64 only; on arm64 Chromium is the only browser). It is the largest
# layer and rarely changes, so it stays above the npm tools.
# /usr/local/bin/chrome points at Chrome, or at Chromium without it, and is the browser agent-browser uses,
# so it needs no download of its own.
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/playwright
ENV AGENT_BROWSER_EXECUTABLE_PATH=/usr/local/bin/chrome
RUN --mount=type=cache,target=/root/.npm \
  npm install -g playwright \
  && playwright install --with-deps chromium \
  && if [ "$(dpkg --print-architecture)" = amd64 ]; then playwright install --with-deps chrome; fi \
  && chmod -R a+rX /opt/playwright \
  && if [ -x /opt/google/chrome/chrome ]; then ln -s /opt/google/chrome/chrome /usr/local/bin/chrome; \
     else ln -s "$(find /opt/playwright -type f -name chrome -path '*chromium-*' | head -n 1)" /usr/local/bin/chrome; fi \
  && test -x /usr/local/bin/chrome \
  && rm -rf /var/lib/apt/lists/*
