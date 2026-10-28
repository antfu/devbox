FROM ghcr.io/getpaseo/paseo:latest
# Stay root: the base entrypoint drops the daemon and its agents to the `paseo` user.
USER root
RUN apt-get update && apt-get install -y --no-install-recommends gnupg && rm -rf /var/lib/apt/lists/*
RUN npm install -g @anthropic-ai/claude-code opencode-ai @mariozechner/pi-coding-agent
# Imports the GPG signing key, then runs the base entrypoint.
COPY git-setup.sh /usr/local/bin/paseo-git-setup
ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/paseo-git-setup"]
