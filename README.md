# @antfu/containers

Configs and setup for my personal container workflow. This repo stays private. It holds specific configs and non-secret env, never secrets.

It deploys one [dev-container](https://github.com/antfu/dev-container) stack on an always-on Mac at home. Every service is reachable only over Tailscale, each on its own node.

| Service | Tailnet host | Listens on | What it is |
| --- | --- | --- | --- |
| `hub` | `hub` | 8100 | Placeholder server. The standalone hub UI from agent-container replaces it. |
| `paseo` | `paseo` | 6767 | Paseo daemon with web UI, plus Claude Code, OpenCode and Pi. |
| `vi` | `vi` | 5656 | [vi](https://github.com/antfu/vi) video library, served from `VI_LIBRARY`. |

Each service is served at `https://<host>.<tailnet>.ts.net` on port 443, e.g. `https://hub.kudu-cardassian.ts.net`. The port column is where the service listens inside the stack and on `127.0.0.1`.

## Layout

- `dev-container.config.ts`: the stack.
- `services/*/Dockerfile`: image for each service. `services/hub/dist` is built output.
- `src/hub`: the hub stub.
- `src/sync.ts`, `src/launchd.ts`: auto-sync.
- `vendor/dev-container`, `vendor/vi`: git submodules, pinned by commit.

## Set up the host

```sh
git clone --recurse-submodules <this repo> && cd containers
pnpm install
pnpm vendor:setup            # build the dev-container CLI
cp .env.example .env         # passed into the containers: VI_LIBRARY, git identity, PASEO_PASSWORD, GPG key
cp .env.secret.example .env.secret   # isolated by the broker: TS_AUTHKEY, GITHUB_TOKEN
pnpm build           # bundle the hub stub, build the images
pnpm run up          # build and start the containers
```

Tailnet HTTPS certificates must be enabled for `tailscale serve` to work.

## Auto-sync

`pnpm sync` runs `git pull --ff-only`, updates the submodules, and redeploys only if HEAD moved since the last good deploy. A failed deploy keeps the old containers running and is retried on the next run. Use `pnpm sync --force` to redeploy anyway.

```sh
pnpm autosync:install     # launchd agent, every 5 minutes, log in .sync/sync.log
pnpm autosync:uninstall
```

## Upgrade the submodules

```sh
pnpm vendor:upgrade              # both
pnpm vendor:upgrade dev-container
pnpm vendor:upgrade vi
```

This moves each to its remote's latest commit and rebuilds dev-container if it moved. It does not commit. Review with `git diff --submodule`, then commit the new pointers. The host picks them up on its next sync.

## Secrets

Both files live only on the host and are gitignored; the `.example` files document them.

- `.env` is passed into the containers. It holds `PASEO_PASSWORD` and `GPG_PRIVATE_KEY` (optional; empty means unsigned commits) and `GPG_PUBLIC_KEY`, which a process has to hold itself, plus settings such as `VI_LIBRARY`, `TAILNET_DOMAIN`, `GIT_NAME` and `GIT_EMAIL`. Use a dedicated GPG signing key, since any agent in the paseo cage can use it.
- `.env.secret` is isolated. The broker swaps `GITHUB_TOKEN` in on the wire, so the containers only see a placeholder. `TS_AUTHKEY` is read by the Tailscale sidecars only.
