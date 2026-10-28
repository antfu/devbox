# @antfu/containers

Configs and setup for my personal container workflow. This repo stays private. It holds specific configs and non-secret env, never secrets.

It deploys one [dev-container](https://github.com/antfu/dev-container) stack on an always-on Mac at home. Every service is reachable only over Tailscale, each on its own node.

| Service | Tailnet host | Port | What it is |
| --- | --- | --- | --- |
| `hub` | `hub` | 8100 | Placeholder server. The standalone hub UI from agent-container replaces it. |
| `paseo` | `paseo` | 6767 | Paseo daemon with web UI, plus Claude Code, OpenCode and Pi. |
| `vi` | `vi` | 5656 | [vi](https://github.com/antfu/vi) video library, served from `VI_LIBRARY`. |

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
cp .env.example .env         # non-secret settings, e.g. VI_LIBRARY
cp .env.secret.example .env.secret   # fill in TS_AUTHKEY and PASEO_PASSWORD
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

`.env.secret` lives only on the host and is gitignored. `.env` is gitignored too, and `.env.example` documents it.
