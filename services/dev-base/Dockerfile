# The toolchain used by paseo: the agent CLIs, agent-browser, jup's shims and GPG, on top of
# paseo-base.
# Built as `dev-base` by `pnpm build:dev-base`, before the services that start FROM it.
# It starts from paseo-base, built by `pnpm build:paseo`: the upstream release vendor/paseo pins, with the
# patches in services/paseo/patches applied, built with upstream's own docker/base/Dockerfile on top of
# paseo-toolchain (services/toolchain), which holds the system packages, jup, uv, Rust and Chromium. That image
# supplies the `paseo` user (uid 1000), tini, gosu, /workspace and an entrypoint that runs any command it is
# given as that user; paseo's daemon only starts when no command is given. See AGENTS.md.
FROM paseo-base
# Stay root: the base entrypoint drops the daemon and its agents to the `paseo` user.
USER root

# The npm tools move fastest, so they come last of the installs. Add or bump packages here only.
RUN --mount=type=cache,target=/root/.npm \
  npm install -g @anthropic-ai/claude-code @openai/codex opencode-ai @mariozechner/pi-coding-agent agent-browser skills taze @antfu/ni

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
COPY dev-base-entrypoint.sh /usr/local/bin/dev-base-entrypoint.sh
ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/dev-base-entrypoint.sh"]
