# @antfu/devbox

Run [Paseo](https://github.com/getpaseo/paseo) coding agents in network-caged containers on an always-on machine, with one GitHub account per agent server. It is one [dev-container](https://github.com/antfu/dev-container) stack, and every service is reachable only over Tailscale. Fork it and edit `dev-container.config.ts` for your own accounts.

## How it fits together

```text
 browser / Paseo app ──── Tailscale (HTTPS, tailnet only) ────┐
                                                              │
   ┌──────────────── caged network, no direct internet ───────┼───────────────┐
   │  paseo        web UI only: lists the two servers below   │               │
   │  paseo-bot    runs agents as the bot GitHub account      │ tailscale     │
   │  paseo-main   runs agents as your main GitHub account    │ sidecar       │
   │        │                                                 │ per service   │
   └────────┼─────────────────────────────────────────────────┴───────────────┘
            ▼
         broker ── swaps placeholder tokens for real ones, only towards allowed hosts ──► internet
```

- **`paseo`** is the client. It serves the Paseo web UI, and runs no agents. You open it and add the two servers as hosts, then switch between them in the UI.
- **`paseo-bot` and `paseo-main`** are the servers, the same image with separate homes, logins and projects. Each has its own GitHub token and commit identity, so the bot's agents never see your main account's private repos. `paseo-main` gets its token from `GITHUB_TOKEN_MAIN` through dev-container's per-service secrets, and its npm token, if any, from `NPM_TOKEN_MAIN`.
- **The cage:** the services sit on a network with no route out. Their traffic goes through the **broker**, which holds the real tokens. The containers only see placeholders, and the broker swaps in the real value on the wire, only for the hosts a token is bound to. A **relay** publishes the ports on the host, and a **Tailscale sidecar** per service serves each one at `https://<prefix><name>.<your-tailnet>.ts.net`. A dashboard at `monitor` lists the services and has an Upgrade button.
- **The images** build in layers, so a change only rebuilds what it touches: `paseo-toolchain` (system packages, Rust, Chromium, on a node image pinned by digest), then `paseo-base` (upstream Paseo with our [patches](#paseo-patches)), then `dev-base` (agent CLIs, GPG), then the services. Each agent CLI is its own linked layer, so a patch change or one CLI's release leaves the other layers, and their digests, as they were: a pull downloads only what changed.

In the web UI, add `paseo-bot` and `paseo-main` as hosts, using `CLIENT_ACCESS_PASSWORD` as the password. Tailnet HTTPS certificates must be enabled.

## Set up

```sh
git clone --recurse-submodules <this repo> && cd devbox
pnpm install
pnpm vendor:setup                    # build the dev-container CLI
cp .env.example .env                 # settings the containers can see
cp .env.secret.example .env.secret   # secrets only the broker sees: TS_AUTHKEY, GITHUB_TOKEN_BOT, GITHUB_TOKEN_MAIN, NPM_TOKEN_MAIN
pnpm keys:setup                      # signing keys, see below
pnpm run up                          # build and start
pnpm down                            # stop
```

The repo holds no secrets. `.env`, `.env.secret` and `keys/` stay on the host and git ignores them. The broker swaps the real GitHub tokens in on the wire, so the containers only see placeholders.

## Prebuilt images

Building the images from scratch is slow. A GitHub workflow ([images.yml](.github/workflows/images.yml)) builds them for arm64 and pushes `ghcr.io/<owner>/<repo>/paseo`. To pull that instead of building, set `IMAGE_REGISTRY=ghcr.io/<owner>/<repo>` in `.env`. `IMAGE_TAG` pins a tag and defaults to `latest`. For a private package, run `docker login ghcr.io` once.

The image bundles Claude Code, Codex and Chrome, so think about their licenses before making the package public.

## Always-on MacBook

1. Install Docker Desktop or [OrbStack](https://orbstack.dev) and turn on "Start at login".
2. Stay awake with the lid closed, and restart after a power cut:

   ```sh
   sudo pmset -a sleep 0 disablesleep 1 autorestart 1 womp 1
   ```

   Undo it with `sudo pmset -a disablesleep 0` before carrying the laptop in a bag.
3. Turn on automatic login in System Settings → Users & Groups. It does not work with FileVault, so with FileVault on, a reboot waits for your password.
4. Run `pnpm daemon:install`. It starts at login and brings the stack up.
5. Upgrade from `https://<prefix>monitor.<your-tailnet>.ts.net` (log in with `CLIENT_ACCESS_PASSWORD`) or run `pnpm selfupgrade`. It pulls the repo, builds or pulls the images, then restarts, so a failed build keeps the old containers running.

## Several laptops

Give each laptop its own `.env`, `.env.secret` and signing keys. Set `TAILNET_PREFIX` in `.env` (for example `mbp-`) so its nodes are `mbp-paseo`, `mbp-paseo-bot`, `mbp-paseo-main` and `mbp-monitor`. Any laptop's web UI can add the servers of the others, since the daemons accept every origin on the tailnet. Each laptop has its own dashboard. A single page for all laptops is not built yet.

## Commit signing

Each server signs commits with its own GPG key, because GitHub only verifies a key that belongs to the committer's account. Set `GIT_NAME_BOT`, `GIT_EMAIL_BOT`, `GIT_NAME_MAIN` and `GIT_EMAIL_MAIN` in `.env`, then:

```sh
pnpm keys:setup          # makes the missing keys in keys/gpg/<bot|main>
pnpm keys:setup main     # one key; add --force to replace it
```

Add each printed public key to the matching account at [github.com/settings/gpg/new](https://github.com/settings/gpg/new), using an email verified there. Restart the server afterwards. The keys have no passphrase and any agent in the container can use them, so keep them dedicated to this.

## Paseo patches

Paseo is built from upstream at a release tag (`vendor/paseo`) plus our patches in `services/paseo/patches`. [FORK.md](services/paseo/FORK.md) lists what each one does, and [AGENTS.md](AGENTS.md#the-paseo-patches) has the rules.

```sh
pnpm paseo:edit              # the patches as commits in .cache/paseo-work
pnpm paseo:export            # write them back
pnpm vendor:upgrade paseo    # move to the newest release, then paseo:edit to replay the patches
```

`pnpm vendor:upgrade` with no name also moves dev-container to its latest commit. Neither commits, so review with `git diff --submodule`.

## Defaults for agents

- **Permissions and setup script.** Our patches add two host settings in the web UI: a default permission mode per provider (the container is the isolation, so bypass mode is fine) and a default worktree setup script such as `pnpm install`.
- **No Claude trailer.** On start, Claude Code is set to add no `Co-Authored-By` line or "Generated with Claude Code" text. A value you set yourself wins.
- **Skills.** On start, the servers install the global skills listed in `services/paseo/skills.txt`. Edit it and rebuild to change them.
- **Agent instructions.** On start, the servers write `services/paseo/agent-instructions.md` into each agent's global instructions (Claude Code's `~/.claude/CLAUDE.md`, and the `AGENTS.md` of Codex, OpenCode and Pi), between marker lines, so the rest of those files stays. Edit it and rebuild to change them.
