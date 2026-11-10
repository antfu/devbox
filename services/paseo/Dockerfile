# Everything paseo runs on, from system packages to the agent CLIs, is in the shared dev-base, so every
# paseo service reuses the same layers. Paseo's daemon is dev-base's default command.
FROM dev-base

# On start, writes agent-instructions.md into the agents' global instructions and installs the global skills of
# skills.txt (the `skills` CLI is in dev-base), then runs dev-base's entrypoint.
COPY skills.txt /etc/paseo-skills.txt
# The shared instructions for every agent, written into their global CLAUDE.md / AGENTS.md on start.
COPY agent-instructions.md /etc/paseo-agent-instructions.md
COPY install-instructions.mjs /usr/local/bin/install-instructions.mjs
COPY install-skills.sh /usr/local/bin/install-skills.sh
RUN chmod +x /usr/local/bin/install-skills.sh
ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/install-skills.sh"]
