# Everything paseo runs on, from system packages to the agent CLIs, is in the shared dev-base, so every
# paseo service reuses the same layers. Paseo's daemon is dev-base's default command.
FROM dev-base

# On start, installs the global skills of skills.txt for the agents (the `skills` CLI is in dev-base), then runs
# dev-base's entrypoint.
COPY skills.txt /etc/paseo-skills.txt
COPY install-skills.sh /usr/local/bin/install-skills.sh
RUN chmod +x /usr/local/bin/install-skills.sh
ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/install-skills.sh"]
