#!/usr/bin/env bash
# Installs the global skills of skills.txt for the agents, then runs dev-base's entrypoint.
#
# On every start, in the background and as the image's unprivileged user, each source of skills.txt is
# installed with `skills add --global`: Claude Code reads ~/.claude/skills, and the other agents (OpenCode,
# Pi, Codex) read ~/.agents/skills. It runs again on each start, so new and updated skills arrive with a
# restart. It does not delay the daemon, and one failed source does not stop the others. It needs the
# network, which the broker allows. Before that, install-instructions.mjs writes agent-instructions.md into the
# agents' global CLAUDE.md / AGENTS.md. INSTALL_SKILLS=0 skips both, for a daemon that runs no agents.
set -uo pipefail

LIST="${SKILLS_LIST:-/etc/paseo-skills.txt}"

# Runs as the image's unprivileged user, with HOME set.
install_all() {
  local line source names
  local -a args
  local failed=0 count=0
  while IFS= read -r line; do
    line="${line%%#*}"
    read -ra args <<< "$line"
    [[ ${#args[@]} -gt 0 ]] || continue
    source="${args[0]}"
    names=("${args[@]:1}")
    [[ ${#names[@]} -gt 0 ]] || names=('*')
    echo "install-skills: $source ${names[*]}"
    if DISABLE_TELEMETRY=1 skills add "$source" --global --yes --agent claude-code codex opencode pi --skill "${names[@]}" < /dev/null; then
      count=$((count + 1))
    else
      failed=$((failed + 1))
      echo "install-skills: could not install $source" >&2
    fi
  done < "$LIST"
  echo "install-skills: done, $count sources installed, $failed failed"
}

if [[ "${1:-}" == --install ]]; then
  install_all
  exit 0
fi

if [[ "${INSTALL_SKILLS:-1}" != 0 && -f "$LIST" ]]; then
  RUN_USER="$(getent passwd 1000 | cut -d: -f1)"
  RUN_HOME="$(getent passwd 1000 | cut -d: -f6)"
  # The home is a host mount that the base entrypoint may still be chowning.
  (
    until gosu "$RUN_USER" test -w "$RUN_HOME"; do sleep 1; done
    # The shared agent instructions first: they need no network and take no time.
    gosu "$RUN_USER" env HOME="$RUN_HOME" node /usr/local/bin/install-instructions.mjs
    gosu "$RUN_USER" env HOME="$RUN_HOME" "$0" --install
  ) &
fi

exec /usr/local/bin/dev-base-entrypoint.sh "$@"
