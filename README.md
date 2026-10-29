# @antfu/containers

Configs and setup for my personal container workflow. This repo stays private. It holds specific configs and non-secret env, never secrets.

It deploys one [dev-container](https://github.com/antfu/dev-container) stack on an always-on Mac at home. Every service is reachable only over Tailscale, each on its own node.

| Service | Tailnet host | Listens on | What it is |
| --- | --- | --- | --- |
| `hub` | `hub` | 8100 | Placeholder server. The standalone hub UI from agent-container replaces it. |
| `paseo` | `paseo` | 6767 | Paseo daemon with web UI, plus Claude Code, OpenCode and Pi. |
| `lody` | none | none | [Lody](https://lody.ai) daemon: connects out to Lody so you can dispatch Claude Code, OpenCode and Pi from its apps. |
| `vi` | `vi` | 5656 | [vi](https://github.com/antfu/vi) video library, served from `VI_LIBRARY`. |

Each service is served at `https://<host>.<tailnet>.ts.net` on port 443, e.g. `https://hub.kudu-cardassian.ts.net`. The port column is where the service listens inside the stack and on `127.0.0.1`.

## Layout

- `dev-container.config.ts`: the stack.
- `services/*/Dockerfile`: image for each service. `services/hub/dist` is built output.
- `services/dev-base`: the `dev-base` image, the toolchain paseo, hub and lody start FROM (system packages, jup, uv, Chromium, agent CLIs such as Claude Code, Codex, OpenCode and Pi, GPG) and a generic entrypoint that imports the signing key. It knows nothing about skills; those belong to paseo. `pnpm build:dev-base` builds it as `dev-base`; `build`, `up` and the self-upgrade run it first.
- `src/hub`: the hub stub.
- `vendor/dev-container`, `vendor/vi`: git submodules, pinned by commit.

## Set up the host

```sh
git clone --recurse-submodules <this repo> && cd containers
pnpm install
pnpm vendor:setup            # build the dev-container CLI
cp .env.example .env         # passed into the containers: VI_LIBRARY, git identity, PASEO_PASSWORD, LODY_AUTH
cp .env.secret.example .env.secret   # isolated by the broker: TS_AUTHKEY, GITHUB_TOKEN
pnpm build           # bundle the hub stub, build dev-base and the service images
pnpm run up          # build and start the containers
pnpm down            # stop and remove the containers
```

Tailnet HTTPS certificates must be enabled for `tailscale serve` to work.

## Daemon and upgrade

`pnpm daemon:install` registers `dev-container daemon run` to start at login: a launchd agent on macOS, a systemd user unit on Linux. The daemon serves the dashboard API and page on `127.0.0.1:7357`, and shows how many new commits the checkout is behind. Nothing upgrades on its own. The dashboard's **Upgrade** button (or `pnpm selfupgrade`) pulls the repo, updates the submodules, runs `selfUpgrade.command`, builds the images and only then restarts the services, so a failed build keeps the old containers running. The dashboard token is `DEV_CONTAINER_DASHBOARD_TOKEN` from `.env` when set, else the random one in `.dev-container/dashboard-token`.

```sh
pnpm daemon:install
pnpm daemon:uninstall
```

## Upgrade the submodules

```sh
pnpm vendor:upgrade              # both
pnpm vendor:upgrade dev-container
pnpm vendor:upgrade vi
```

This moves each to its remote's latest commit and rebuilds dev-container if it moved. It does not commit. Review with `git diff --submodule`, then commit the new pointers. The host picks them up on its next upgrade.

## Commit signing

The agents in paseo and lody sign commits and tags with a GPG key. `keys/gpg/` is git-ignored and mounted read-only at `/etc/signing`; its `gitconfig` is read through `GIT_CONFIG_SYSTEM`, and `private.asc` is imported on every start into a keyring on the container's own filesystem (`GNUPGHOME=/opt/gnupg`), because gpg-agent's socket cannot live on the host mount. To create or rotate the key:

```sh
pnpm keys:setup            # add --force to replace an existing key
```

It uses `GIT_NAME` and `GIT_EMAIL` from `.env`, builds the key in a throwaway keyring and prints the public key. Add that to GitHub at [github.com/settings/gpg/new](https://github.com/settings/gpg/new), then restart paseo. The key has no passphrase and any agent in the cage can use it, so make it a dedicated one.

## Skills

Paseo's agents get the global skills listed in `services/paseo/skills.txt`. The host installs them, and paseo only mounts them:

```sh
pnpm skills:sync                  # install the list into ./skills (git-ignored)
pnpm dc compose restart paseo     # link-skills relinks them into the agents' home
```

`./skills` is mounted read-only at `/opt/skills`. On every start paseo's `link-skills` entrypoint links each skill into `~/.agents/skills` (OpenCode, Pi, Codex) and `~/.claude/skills` (Claude Code), next to the skills Paseo writes itself. Nothing is installed or fetched when the container starts. lody does not get these skills.

## Secrets

Both files live only on the host and are gitignored; the `.example` files document them.

- `.env` is passed into the containers. It holds `PASEO_PASSWORD`, which the daemon checks itself, plus settings such as `VI_LIBRARY`, `TAILNET_DOMAIN`, `GIT_NAME` and `GIT_EMAIL`.
- `.env.secret` is isolated. The broker swaps `GITHUB_TOKEN` in on the wire, so the containers only see a placeholder. `TS_AUTHKEY` is read by the Tailscale sidecars only.
