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

# Claude Code adds no co-author trailer or PR line unless the user's settings say otherwise.
gosu "$RUN_USER" env HOME="$RUN_HOME" node /usr/local/bin/seed-claude-settings.mjs

exec /usr/local/bin/paseo-docker-entrypoint "$@"
