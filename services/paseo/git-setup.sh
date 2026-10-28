#!/usr/bin/env bash
# Imports the GPG keys and, when there is a private key, turns on commit signing, then hands over to
# the base entrypoint. With no private key, commits stay unsigned.
set -euo pipefail

HOME_DIR=/home/paseo

# /home/paseo is a persisted volume that starts out owned by root.
mkdir -p "$HOME_DIR"
[[ "$(stat -c %u "$HOME_DIR")" == 0 ]] && chown paseo:paseo "$HOME_DIR"

as_paseo() { gosu paseo env HOME="$HOME_DIR" "$@"; }

# GPG_PUBLIC_KEY is a base64 armored public key, imported so signatures can be verified.
if [[ -n "${GPG_PUBLIC_KEY:-}" ]]; then
  printf '%s' "$GPG_PUBLIC_KEY" | base64 -d | as_paseo gpg --batch --quiet --import
fi

if [[ -n "${GPG_PRIVATE_KEY:-}" ]]; then
  # GPG_PRIVATE_KEY is a base64 armored key without a passphrase. It is unset after the import,
  # so the daemon and its agents do not inherit it.
  printf '%s' "$GPG_PRIVATE_KEY" | base64 -d | as_paseo gpg --batch --quiet --import
  fpr="$(as_paseo gpg --batch --list-secret-keys --with-colons | awk -F: '/^fpr:/ { print $10; exit }')"
  as_paseo git config --global user.signingkey "$fpr"
  as_paseo git config --global commit.gpgsign true
  as_paseo git config --global tag.gpgsign true
else
  # The home volume persists, so drop signing left over from an earlier run.
  for key in user.signingkey commit.gpgsign tag.gpgsign; do
    as_paseo git config --global --unset-all "$key" || true
  done
fi
unset GPG_PRIVATE_KEY GPG_PUBLIC_KEY

exec /usr/local/bin/paseo-docker-entrypoint "$@"
