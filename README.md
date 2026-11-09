# @antfu/containers

My setup for running [Paseo](https://github.com/getpaseo/paseo) coding agents in network-caged containers on an always-on machine at home. Fork it and edit `dev-container.config.ts` for your own accounts and hostnames.

It deploys one [dev-container](https://github.com/antfu/dev-container) stack. Every service is reachable only over Tailscale, each on its own node. The repo holds configs and non-secret settings only: tokens and keys live in `.env.secret` and `keys/` on the host, which git ignores.

| Service | Tailnet host | Listens on | What it is |
| --- | --- | --- | --- |
| `paseo` | `paseo` | 6767 | The Paseo client: serves the web UI, which connects to `paseo-bot` and `paseo-main`. Same image, but with no model keys, signing key, git identity or skills, so it does not run agents. |
| `paseo-bot` | `paseo-bot` | 6769 | Paseo server for the bot account, with Claude Code, OpenCode and Pi. Uses `GITHUB_TOKEN`. |
| `paseo-main` | `paseo-main` | 6768 | Paseo server for your main account, same image, own home. Uses your main account's `GITHUB_TOKEN_MAIN`, for repos the bot cannot reach. |

Each service is served at `https://<prefix><host>.<tailnet>.ts.net` on port 443 (`TAILNET_PREFIX` is empty by default), e.g. `https://paseo.<your-tailnet>.ts.net`. The port column is where the service listens inside the stack and on `127.0.0.1`.

## Layout

- `dev-container.config.ts`: the stack.
- `services/*/Dockerfile`: image for each service.
- `services/toolchain`: the `paseo-toolchain` image, with the heavy, slow-changing layers (system packages, jup, uv, Rust, Chromium, Chrome on amd64, Playwright). It is the base image of paseo's own build, so changing the paseo patches or release never rebuilds it.
- `services/dev-base`: the `dev-base` image, the toolchain paseo starts FROM (on top of that: agent-browser, agent CLIs such as Claude Code, Codex, OpenCode and Pi, GPG) and a generic entrypoint that imports the signing key. It knows nothing about skills; those belong to paseo. It starts FROM `paseo-base`. `pnpm build:toolchain` builds `paseo-toolchain`, `pnpm build:paseo` builds `paseo-base` from upstream paseo with our patches applied, on top of it, and `pnpm build:dev-base` builds `dev-base`; `build`, `up` and the self-upgrade run all three, in that order.
- `vendor/dev-container`, `vendor/paseo`: git submodules, pinned by commit. `vendor/paseo` is upstream paseo at a release tag, and `services/paseo/patches` holds our changes to it as a patch series: see [Paseo patches](#paseo-patches).

## Set up the host

```sh
git clone --recurse-submodules <this repo> && cd containers
pnpm install
pnpm vendor:setup            # build the dev-container CLI
cp .env.example .env         # passed into the containers: git identity, CLIENT_ACCESS_PASSWORD
cp .env.secret.example .env.secret   # isolated by the broker: TS_AUTHKEY, GITHUB_TOKEN
pnpm build           # build dev-base and the service images
pnpm run up          # install, sync submodules, apply patches, build and start
pnpm down            # stop and remove the containers
```

Tailnet HTTPS certificates must be enabled for `tailscale serve` to work.

## Prebuilt images

Building the toolchain, paseo and dev-base takes a long time. The `Images` workflow ([.github/workflows/images.yml](.github/workflows/images.yml)) builds the chain on GitHub for arm64 and pushes `ghcr.io/<owner>/<repo>/paseo` on every change to `services/` or the paseo pin, on demand, and weekly. To use it on a machine, set `IMAGE_REGISTRY=ghcr.io/<owner>/<repo>` in `.env` (and `IMAGE_TAG` to pin a tag; the default `latest` follows CI). Then `pnpm build` skips the three long builds, and the daemon's upgrade pulls the new image before it restarts anything. If the package is private, run `docker login ghcr.io` once with a token that can read packages. Leave `IMAGE_REGISTRY` empty to keep building locally.

Check the package's visibility under the repo's Packages after the first run: new packages may start private. The image bundles Claude Code, Codex and Chrome, so decide whether you want it public before you make it so.

## Hands-off server on a MacBook

To run the stack on a MacBook that nobody touches, so it survives closed lids, reboots and power cuts:

1. **Docker that starts by itself.** Install Docker Desktop or [OrbStack](https://orbstack.dev) and turn on "Start at login" in its settings. The services use `restart: unless-stopped`, so they come back as soon as Docker is up.
2. **Never sleep.** The laptop has to stay awake with the lid closed. Keep it on the charger and run:

   ```sh
   sudo pmset -a sleep 0 disablesleep 1 autorestart 1 womp 1
   ```

   `disablesleep` keeps it awake with the lid closed, `autorestart` boots it again after a power cut, and `womp` allows wake over the network. On a laptop in a bag, undo it with `sudo pmset -a disablesleep 0`, or it will run hot.
3. **Log in without you.** Docker and the daemon below start at login, not at boot. In System Settings → Users & Groups, set automatic login for the user that owns the stack. Automatic login does not work with FileVault, so either turn FileVault off or accept that a reboot waits for you to type the password once.
4. **Install the daemon.** Do [Set up the host](#set-up-the-host), then run `pnpm daemon:install`. Next time the machine logs in, the daemon starts and brings the stack up.
5. **Reach it from anywhere.** Everything is on your tailnet, so open `https://<prefix>paseo.<your-tailnet>.ts.net` from any device. For a shell on the laptop itself, turn on System Settings → General → Sharing → Remote Login and install Tailscale on the host too. The stack's own sidecars give the services nodes, not the machine.
6. **Upgrade from the dashboard.** Open `https://<prefix>monitor.<your-tailnet>.ts.net`, sign in with `CLIENT_ACCESS_PASSWORD` and press **Upgrade**. See [Daemon and upgrade](#daemon-and-upgrade).

Check it once by running `sudo pmset -g | grep -E 'sleep|autorestart'`, closing the lid, and opening the client from your phone.

## Daemon and upgrade

`pnpm daemon:install` registers `dev-container daemon run` to start at login: a launchd agent on macOS, a systemd user unit on Linux. The daemon serves the dashboard API and page on `127.0.0.1:7357`, and shows how many new commits the checkout is behind. Nothing upgrades on its own. The dashboard's **Upgrade** button (or `pnpm selfupgrade`) pulls the repo, updates the submodules, runs `selfUpgrade.command`, builds the images and only then restarts the services, so a failed build keeps the old containers running. The dashboard token is `CLIENT_ACCESS_PASSWORD` from `.env` when set, else the random one in `.dev-container/dashboard-token`.

```sh
pnpm daemon:install
pnpm daemon:uninstall
```

## Upgrade the submodules

```sh
pnpm vendor:upgrade              # all of them
pnpm vendor:upgrade dev-container
pnpm vendor:upgrade paseo        # the newest stable release tag, not main
```

This moves dev-container to its remote's latest commit, and paseo to its newest release, and rebuilds dev-container if it moved. It does not commit. Review with `git diff --submodule`, then commit the new pointers. The host picks them up on its next upgrade.

## Paseo patches

Paseo is built from `vendor/paseo`, upstream at a release tag, with the patches in `services/paseo/patches` applied. [services/paseo/FORK.md](services/paseo/FORK.md) says what each one does and why; [AGENTS.md](AGENTS.md#the-paseo-patches) has the rules.

```sh
pnpm build:toolchain # the paseo-toolchain image (system packages, Rust, Chromium), cached across paseo changes
pnpm build:paseo     # apply the series in .cache/paseo-build and build the paseo-base image on it
pnpm paseo:edit      # the series as commits on the `patches` branch in .cache/paseo-work
pnpm paseo:export    # write those commits back to services/paseo/patches
```

To move to a new release: `pnpm vendor:upgrade paseo`, then `pnpm paseo:edit` replays the series onto it and stops on a conflict for you to resolve with `git am --continue`, then `pnpm paseo:export`.

## Paseo client and two servers

`paseo` is the client: open `https://paseo.<tailnet>.ts.net` and it serves the web UI. It is the same daemon image, but the config gives it none of what agents need (model keys, the signing key, git identity, skills), so agents belong on the two servers. `paseo-bot` and `paseo-main` are the servers that run the agents, each with its own home, logins and projects. In the UI, add `https://paseo-bot.<tailnet>.ts.net` and `https://paseo-main.<tailnet>.ts.net` as hosts (same `CLIENT_ACCESS_PASSWORD`) and switch between them in the host picker. The host list is kept in the browser, so add them once per browser. The two servers allow the client's origin, which the browser's websocket needs.

The servers differ in the GitHub token: dev-container swaps in `GITHUB_TOKEN` for `paseo-bot` and `GITHUB_TOKEN_MAIN` for `paseo-main` (the service's `secrets` option), so git and `gh` act as the bot on one and as you on the other. Both tokens stay with the broker. Set `GITHUB_TOKEN_MAIN` in `.env.secret` before `pnpm up`. Each server signs with its own key: see [Commit signing](#commit-signing).

## Commit signing

The agents in paseo sign commits and tags with a GPG key, one per server, because GitHub only verifies a signature whose key belongs to the committer's account. `paseo-bot` uses `keys/gpg/bot` and `paseo-main` uses `keys/gpg/main`, with `GIT_NAME_BOT` and `GIT_EMAIL_BOT` for the first and `GIT_NAME_MAIN` and `GIT_EMAIL_MAIN` for the second. `keys/gpg/` is git-ignored and each folder is mounted read-only at `/etc/signing` in its server; its `gitconfig` is read through `GIT_CONFIG_SYSTEM`, and `private.asc` is imported on every start into a keyring on the container's own filesystem (`GNUPGHOME=/opt/gnupg`), because gpg-agent's socket cannot live on the host mount. To create or rotate a key:

```sh
pnpm keys:setup            # makes the keys that are missing
pnpm keys:setup main       # one identity; add --force to replace an existing key
```

It builds the key in a throwaway keyring and prints the public key. Add that to the matching GitHub account at [github.com/settings/gpg/new](https://github.com/settings/gpg/new), then restart the server. The email must be one verified on that account. The key has no passphrase and any agent in the cage can use it, so make it a dedicated one.

## Several laptops

Each laptop runs its own copy of this stack with its own `.env`. Set `TAILNET_PREFIX` there (for example `mbp-`), so every tailnet node is named `<prefix><service>` (`mbp-paseo`, `mbp-paseo-bot`, `mbp-paseo-main`, `mbp-monitor`) and nothing collides on the tailnet. The client on a laptop allows only that laptop's origins, so add that laptop's two servers as its hosts. Each laptop also needs its own `.env.secret`, and either its own signing keys (add each public key to GitHub) or a copy of `keys/`. Host ports are per machine, so they stay the same.

The dashboard is per laptop, at `https://<prefix>monitor.<tailnet>.ts.net`. A single page that lists every laptop is not built yet: it needs dev-container to read several dashboards, which are already token-protected HTTP APIs on the tailnet.

## Bypass mode and worktree setup

Our paseo patches add two host settings, so no seed script or plugin is needed (see [services/paseo/FORK.md](services/paseo/FORK.md), F-3 and F-4). Both live in the app under the host's settings, and are saved in paseo's `config.json`:

- **Agents → Default mode** sets a default permission mode per provider. The container is the isolation here, so pick the bypass mode (Claude `bypassPermissions`, Codex `full-access`). OpenCode and Pi have no bypass mode.
- **Workspaces → default setup script** is the command run in each new worktree whose repo has no `worktree.setup` in its `paseo.json`, for example `pnpm install`.

## Claude Code attribution

On every start dev-base adds `"attribution": { "commit": "", "pr": "" }` to Claude Code's user settings (`~/.claude/settings.json`) in paseo, so its commits carry no `Co-Authored-By: Claude` trailer and its pull requests no "Generated with Claude Code" line. It is only a default: it adds the key when it is missing, so a value you set later, here or in a project's own `.claude/settings.json`, wins. If the home is not writable on the first start, the next start applies it.

## Skills

Paseo's agents get the global skills listed in `services/paseo/skills.txt`. The image holds the list, and nothing is installed on the host:

```sh
pnpm build && pnpm up             # after editing the list, so the image has the new one
pnpm dc compose restart paseo-bot paseo-main    # reinstall now, e.g. to update the skills
```

On every start the `install-skills.sh` entrypoint runs `skills add --global` for each line, in the background and as the agents' user. It installs into `~/.agents/skills` (OpenCode, Pi, Codex) and `~/.claude/skills` (Claude Code), next to the skills Paseo writes itself. The daemon does not wait for it, and one failed source does not stop the others. Watch it with `pnpm dc compose logs paseo-bot | grep install-skills`. It needs the network (GitHub), which the broker allows. A skill dropped from the list stays in the home until you delete it. The `paseo` client skips it (`INSTALL_SKILLS=0`), since it runs no agents.

## Secrets

Both files live only on the host and are gitignored; the `.example` files document them.

- `.env` is passed into the containers. It holds `CLIENT_ACCESS_PASSWORD`, which the Paseo daemons check themselves and which is also the dashboard token, plus settings such as `TAILNET_DOMAIN`, `TAILNET_PREFIX` and the git identities (`GIT_NAME_BOT`, `GIT_EMAIL_BOT`, `GIT_NAME_MAIN`, `GIT_EMAIL_MAIN`).
- `.env.secret` is isolated. The broker swaps `GITHUB_TOKEN` in on the wire, so the containers only see a placeholder. `TS_AUTHKEY` is read by the Tailscale sidecars only.
