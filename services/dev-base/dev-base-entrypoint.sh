#!/usr/bin/env bash
# Imports the GPG signing key and sets Claude Code's defaults, then runs the image's original entrypoint.
#
# The key is a read-only mount: private.asc in the folder GPG_KEY_FILE points into. The keyring is
# $GNUPGHOME, off the home mount (see the Dockerfile), so the key is imported on every start and before
# anything else runs: a process can commit as soon as the container is up. The test signature starts
# gpg-agent and proves signing works, so a broken setup shows up in the logs.
set -uo pipefail

KEY="${GPG_KEY_FILE:-/etc/signing/private.asc}"
# The image's unprivileged user, whatever it is called.
RUN_USER="$(getent passwd 1000 | cut -d: -f1)"
RUN_HOME="$(getent passwd 1000 | cut -d: -f6)"

import_key() {
  [[ -f "$KEY" ]] || return 0
  gosu "$RUN_USER" env HOME="$RUN_HOME" gpg --batch --import "$KEY" \
    || { echo "dev-base: could not import the signing key" >&2; return 0; }
  if echo test | gosu "$RUN_USER" env HOME="$RUN_HOME" gpg --batch --clearsign > /dev/null; then
    echo "dev-base: signing key ready"
  else
    echo "dev-base: the signing key is imported but cannot sign" >&2
  fi
}

import_key

# npm and pnpm read NPM_TOKEN only through an .npmrc line that names it. With NPM_TOKEN set (a broker
# placeholder, fresh on every start), the user's ~/.npmrc gets that line; without it, the line goes, since
# npm fails on a variable it cannot replace. Other lines are kept.
NPM_AUTH_LINE='//registry.npmjs.org/:_authToken=${NPM_TOKEN}'
sync_npmrc() {
  local npmrc="$RUN_HOME/.npmrc"
  if [[ -n "${NPM_TOKEN:-}" ]]; then
    grep -qxF "$NPM_AUTH_LINE" "$npmrc" 2>/dev/null \
      || gosu "$RUN_USER" sh -c 'printf "%s\n" "$1" >> "$2"' sh "$NPM_AUTH_LINE" "$npmrc"
  elif [[ -f "$npmrc" ]]; then
    gosu "$RUN_USER" sed -i "\\|^//registry\\.npmjs\\.org/:_authToken=\\\${NPM_TOKEN}\$|d" "$npmrc"
  fi
}

sync_npmrc

# Claude Code adds no co-author trailer or PR line unless the user's settings say otherwise.
gosu "$RUN_USER" env HOME="$RUN_HOME" node /usr/local/bin/seed-claude-settings.mjs

exec /usr/local/bin/paseo-docker-entrypoint "$@"
