# syntax=docker/dockerfile:1
# The toolchain used by paseo: the agent CLIs, agent-browser, jup's shims and GPG, on top of
# paseo-base.
# Built as `dev-base` by `pnpm build:dev-base`, before the services that start FROM it.
# It starts from paseo-base, built by `pnpm build:paseo`: the upstream release vendor/paseo pins, with the
# patches in services/paseo/patches applied, built with upstream's own docker/base/Dockerfile on top of
# paseo-toolchain (services/toolchain), which holds the system packages, git-lfs, jup, uv, fnm, Rust and
# Chromium. That image supplies the `paseo` user (uid 1000), tini, gosu, /workspace and an entrypoint that
# runs any command it is given as that user; paseo's daemon only starts when no command is given. See AGENTS.md.

# The agent CLIs are about 1 GB, and paseo-base changes with every patch. Each CLI is installed in its own
# stage on paseo-toolchain, which paseo-base is built on, so the same node runs them, and copied in with
# `COPY --link`. A linked layer does not depend on the layers under it, so a new paseo-base keeps every CLI
# layer, digest included, and a pull downloads only the layers that changed: paseo's after a patch, one CLI's
# after its release.
# Each `*_PACKAGES` arg lists the stage's npm packages. CI passes them pinned to the current versions (see
# .github/workflows/images.yml), so a stage rebuilds when one of its packages has a new release and is cached
# otherwise. Without the args, a build installs the latest versions and then keeps that layer cached.
FROM paseo-toolchain AS agent-cli
# `npm install -g` puts the packages in /opt/agents/lib/node_modules and their commands in /opt/agents/bin.
ENV NPM_CONFIG_PREFIX=/opt/agents

FROM agent-cli AS claude-code
ARG CLAUDE_CODE_PACKAGES="@anthropic-ai/claude-code"
RUN --mount=type=cache,target=/root/.npm npm install -g ${CLAUDE_CODE_PACKAGES}

FROM agent-cli AS codex
ARG CODEX_PACKAGES="@openai/codex"
RUN --mount=type=cache,target=/root/.npm npm install -g ${CODEX_PACKAGES}

FROM agent-cli AS opencode
ARG OPENCODE_PACKAGES="opencode-ai"
RUN --mount=type=cache,target=/root/.npm npm install -g ${OPENCODE_PACKAGES}

FROM agent-cli AS pi
ARG PI_PACKAGES="@mariozechner/pi-coding-agent"
RUN --mount=type=cache,target=/root/.npm npm install -g ${PI_PACKAGES}

# The small tools share one layer.
FROM agent-cli AS tools
ARG TOOLS_PACKAGES="agent-browser skills taze @antfu/ni vercel"
RUN --mount=type=cache,target=/root/.npm npm install -g ${TOOLS_PACKAGES}

FROM paseo-base
# Stay root: the base entrypoint drops the daemon and its agents to the `paseo` user.
USER root

# Add or bump packages in the stages above only.
COPY --link --from=claude-code /opt/agents /opt/agents
COPY --link --from=codex /opt/agents /opt/agents
COPY --link --from=opencode /opt/agents /opt/agents
COPY --link --from=pi /opt/agents /opt/agents
COPY --link --from=tools /opt/agents /opt/agents

# The commands go in /usr/local/bin, where an `npm install -g` would have put them, so they stay on the PATH
# of login shells too, which reset PATH. Then `jup enable`, which replaces the npm, npx and yarn shims with
# jup's: each project then runs the package manager version it pins, and pnpm becomes available. Node stays
# the base image's unless a project pins one.
RUN ln -sf /opt/agents/bin/* /usr/local/bin/ \
  && jup enable

# The GPG keyring lives on the container's own filesystem, not in /home/paseo. gpg-agent puts its socket
# in the keyring folder, and the home is a host mount that cannot hold unix sockets (on macOS hosts),
# which leaves gpg with "can't connect to the agent". The entrypoint imports the key on every start.
ENV GNUPGHOME=/opt/gnupg
RUN install -d -m 700 -o 1000 -g 1000 /opt/gnupg

# On start, imports the signing key mounted at /etc/signing and turns off Claude Code's co-author trailer by
# default, then runs the base entrypoint.
COPY seed-claude-settings.mjs /usr/local/bin/seed-claude-settings.mjs
COPY dev-base-entrypoint.sh /usr/local/bin/dev-base-entrypoint.sh
ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/dev-base-entrypoint.sh"]
