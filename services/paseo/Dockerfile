FROM ghcr.io/getpaseo/paseo:latest
# Stay root: the base entrypoint drops the daemon and its agents to the `paseo` user.
USER root

# Layers run from the least to the most often changed, so an edit near the bottom keeps the heavy layers
# above it cached.

# One apt layer for every system package. gh comes from GitHub's apt repo, since Debian's copy is old.
# It reads the placeholder GITHUB_TOKEN, which the broker swaps for the real token on api.github.com.
# gnupg signs the agents' commits; install-skills imports the key on start.
# Python for the agents: pip is blocked system-wide (PEP 668), so projects use venv or uv.
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl gnupg \
  && curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg -o /usr/share/keyrings/githubcli-archive-keyring.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" > /etc/apt/sources.list.d/github-cli.list \
  && apt-get update && apt-get install -y --no-install-recommends gh python3 python3-pip python3-venv python-is-python3 \
  && rm -rf /var/lib/apt/lists/*

# Tools that have to live outside /home/paseo, which is a host mount and hides anything installed there.
# jup manages package manager and runtime versions; its store is writable by the daemon's user.
# uv sits next to the jup shims in /usr/local/bin.
ENV JUP_HOME=/opt/jup
RUN curl -fsSL https://jup.unjs.io/install.sh | JUP_SHIM_DIRECTORY=/usr/local/bin sh \
  && mkdir -p /opt/jup && chown -R paseo:paseo /opt/jup \
  && curl -LsSf https://astral.sh/uv/install.sh | env UV_INSTALL_DIR=/usr/local/bin UV_NO_MODIFY_PATH=1 sh

# Chromium for Playwright, with the system libraries it needs, shared by every user. It is the largest
# layer and rarely changes, so it stays above the npm tools.
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/playwright
RUN --mount=type=cache,target=/root/.npm \
  npm install -g playwright \
  && playwright install --with-deps chromium \
  && chmod -R a+rX /opt/playwright \
  && rm -rf /var/lib/apt/lists/*

# The npm tools move fastest, so they come last of the installs. Add or bump packages here only.
RUN --mount=type=cache,target=/root/.npm \
  npm install -g @anthropic-ai/claude-code opencode-ai @mariozechner/pi-coding-agent skills taze @antfu/ni

# After every npm install, because it replaces the npm, npx and yarn shims with jup's: each project then
# runs the package manager version it pins, and pnpm becomes available. Node stays the base image's
# unless a project pins one.
RUN jup enable

# Installs the skills in /etc/paseo/skills.txt in the background on start, then runs the base entrypoint.
COPY install-skills /usr/local/bin/install-skills
ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/install-skills"]
