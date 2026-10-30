# Everything paseo runs on, from system packages to the agent CLIs, is in the shared dev-base, so paseo, hub
# and lody reuse the same layers. Paseo's daemon is dev-base's default command.
FROM dev-base

# On start, adds the bypass agent profiles to paseo's config and links the skills mounted at /opt/skills into
# the agents' home, then runs dev-base's entrypoint.
COPY seed-profiles.mjs /usr/local/bin/seed-profiles.mjs
COPY link-skills /usr/local/bin/link-skills
RUN chmod +x /usr/local/bin/link-skills
ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/link-skills"]
