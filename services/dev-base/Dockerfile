# The toolchain shared by paseo, hub, lody and vi: system packages, jup, uv, Rust, Chromium and Chrome, agent-browser,
# the agent CLIs and GPG.
# Built as `dev-base` by `pnpm build:dev-base`, before the services that start FROM it.
# It starts from paseo's image because that supplies the `paseo` user (uid 1000), tini, gosu, /workspace
# and an entrypoint that runs any command it is given as that user; paseo's daemon only starts when no
# command is given.
# Pinned to a stable release: bump it here, then rebuild. The pnpm-install plugin needs 0.14 or newer.
ARG PASEO_VERSION=0.14.0
FROM ghcr.io/getpaseo/paseo:${PASEO_VERSION}
# Stay root: the base entrypoint drops the daemon and its agents to the `paseo` user.
USER root

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
  && mkdir -p /opt/jup && chown -R paseo:paseo /opt/jup \
  && curl -LsSf https://astral.sh/uv/install.sh | env UV_INSTALL_DIR=/usr/local/bin UV_NO_MODIFY_PATH=1 sh

# The Rust toolchain, outside /home/paseo for the same reason. The minimal profile keeps the layer small;
# clippy and rustfmt are added back. The daemon's user owns both folders, so cargo can fetch crates
# and `rustup` can add targets.
ENV RUSTUP_HOME=/opt/rustup CARGO_HOME=/opt/cargo PATH=/opt/cargo/bin:${PATH}
RUN curl -fsSL https://sh.rustup.rs | sh -s -- -y --no-modify-path --profile minimal --component clippy --component rustfmt \
  && chown -R paseo:paseo /opt/rustup /opt/cargo

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

# The npm tools move fastest, so they come last of the installs. Add or bump packages here only.
RUN --mount=type=cache,target=/root/.npm \
  npm install -g @anthropic-ai/claude-code @openai/codex opencode-ai @mariozechner/pi-coding-agent agent-browser lody skills taze @antfu/ni

# After every npm install, because it replaces the npm, npx and yarn shims with jup's: each project then
# runs the package manager version it pins, and pnpm becomes available. Node stays the base image's
# unless a project pins one.
RUN jup enable

# The GPG keyring lives on the container's own filesystem, not in /home/paseo. gpg-agent puts its socket
# in the keyring folder, and the home is a host mount that cannot hold unix sockets (on macOS hosts),
# which leaves gpg with "can't connect to the agent". The entrypoint imports the key on every start.
ENV GNUPGHOME=/opt/gnupg
RUN install -d -m 700 -o 1000 -g 1000 /opt/gnupg

# On start, imports the signing key mounted at /etc/signing and turns off Claude Code's co-author trailer by
# default, then runs the base entrypoint.
COPY seed-claude-settings.mjs /usr/local/bin/seed-claude-settings.mjs
COPY dev-base-entrypoint /usr/local/bin/dev-base-entrypoint
ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/dev-base-entrypoint"]
