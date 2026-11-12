## Rules that apply everywhere

- **MUST**, **MUST NOT**, **SHOULD** and **MAY** use RFC 2119 meanings. They mark
  real invariants - layer boundaries, wire contracts, output shapes - not house style.
- Before a PR, all gates MUST pass:
  `pnpm lint && pnpm knip && pnpm test && pnpm typecheck && pnpm build`.
  Commits follow Conventional Commits.

## The paseo patches

Paseo is built from upstream plus our patches, not pulled from `ghcr.io/getpaseo/paseo`. `vendor/paseo` is a
submodule of [getpaseo/paseo](https://github.com/getpaseo/paseo), pinned at a release tag. Our changes are a
`git format-patch` series in [services/paseo/patches](services/paseo/patches), one file per change, applied in
file name order. There is no fork repo. `pnpm build:paseo` applies the series to a clean copy of the release in
`.cache/paseo-build` and builds it with upstream's own `docker/base/Dockerfile` as the `paseo-base` image, which
`services/dev-base` starts FROM. That build passes `paseo-toolchain` (`services/toolchain`, built by
`pnpm build:toolchain`) as upstream's `NODE_IMAGE` build arg, so the heavy toolchain layers stay cached when the
patches change.

The goal is a series that is cheap to carry onto new upstream releases and still works with every upstream
client. The rules below serve that goal.

### Where things live

- `vendor/paseo` MUST stay on the pinned release with no local changes, so its gitlink only ever records an
  upstream commit. Never commit, branch or apply patches there.
- `.cache/paseo-build` (git-ignored) is rebuilt from scratch on every `pnpm build:paseo`. Never edit it.
- `.cache/paseo-work` (git-ignored) is where you change patches: `pnpm paseo:edit` puts the series on the
  pinned release as commits on its `patches` branch, and `pnpm paseo:export` writes them back. It keeps its
  untracked files (node_modules, built packages) between runs. `edit` refuses to run over commits that are
  not exported yet; `--force` drops them.
- Both are git worktrees of the submodule, so they share its objects and its `rerere` cache. The tool turns
  on `rerere` and `core.checkStat=minimal` there (the second because host mounts change the stat data git
  records, which makes `git am` reject files it just wrote).

### The change ledger

[services/paseo/FORK.md](services/paseo/FORK.md) lists every change the series carries.

- Every user request that changes paseo MUST get a ledger entry (`F-<n>`) in the same commit as the patch
  that ships it. Record the request in the user's words, why it has to be a patch, the patch subjects, the
  files touched, the compatibility notes and when to drop it.
- Patches are listed by subject, not file name, because file names follow the subject and numbering.
- When a change is upstreamed, replaced or abandoned, set its status and drop its patch. Do not delete the
  entry.
- The ledger and anything else about the series stay out of the patches themselves.

### Atomic patches

- One ledger entry SHOULD be one patch, which is one commit in the work tree. Split it only when the parts
  make sense alone (e.g. a protocol addition, then the daemon change that uses it). Each commit MUST build and
  pass upstream's checks on its own.
- Subject: Conventional Commits with upstream's package as scope, e.g. `feat(server): ...`. Body: the why,
  then a `Fork-Change: F-<n>` trailer. `grep -l 'Fork-Change: F-3' services/paseo/patches/*` finds a
  change's patches.
- Follow-up fixes go in as `git commit --fixup=<commit>` and get squashed with
  `GIT_SEQUENCE_EDITOR=: git rebase -i --autosquash <pinned>` before exporting, so the series never has
  "fix the previous patch" patches.
- `pnpm paseo:export` rewrites the whole folder. With nothing changed it writes byte-identical files, so
  `git diff services/paseo/patches` shows exactly what you changed. Review that diff before committing.
- A patch MUST NOT include unrelated formatting, renames or refactors. They make conflicts much worse. Run
  upstream's formatter on your changed files only: `npm run format:files -- <files>`.
- Upstream's checks, run in `.cache/paseo-work`: `npm run format:check:files -- <files>`,
  `npm run lint -- <files>`, `npm run typecheck --workspace=@getpaseo/<pkg>` for each package touched, and
  `npx vitest run <file> --bail=1` per touched test file, from the package's folder. Its own `CLAUDE.md` and
  `docs/` apply there. In particular: never run a whole test suite, and never start, stop or restart a paseo
  daemon, since agents run inside one.
- First-time setup in `.cache/paseo-work`: `ONNXRUNTIME_NODE_INSTALL=skip npm ci --ignore-scripts`, then
  `npm run postinstall` (applies upstream's own `patches/` folder; without it the app typecheck fails in files
  you did not touch), then `npm run build:protocol && npm run build:server-deps && npm run build:app-deps`.
  The CLI typecheck also needs `npm run build --workspace=@getpaseo/server`. Rebuild protocol and client
  after changing them, before typechecking the packages that use them. `npx knip` crashes in its Expo plugin
  here; check orphaned exports by hand.
- Locale files: the app's types require every key in every locale. For a new string, add it to `en.ts` and
  point the other locales at it (`key: en.path.to.key`). That is a one-line edit per locale, not a translation.

### Keep the diff small

Every changed line is a possible conflict on the next release. Choose the first option that works:

1. Config or env in `dev-container.config.ts`, or the paseo service files in `services/paseo`.
2. A paseo plugin in `services/paseo/plugins` (see the `paseo-plugin` skill). Plugins use upstream's public
   API and need no patch.
3. A patch. Inside it, prefer adding new files to editing existing ones, and keep edits to upstream files
   down to small hooks that call into the new files.

Patches MUST NOT touch files that upstream rewrites on every release: the `version` in any `package.json`,
`CHANGELOG*`, release notes, `CLAUDE.md`/`AGENTS.md`, and translations. Edit `package-lock.json` only for a
dependency change, and regenerate it when rebasing instead of resolving it by hand (see below). New strings
are the one exception for locale files (see above).

### Compatibility with upstream clients

The official desktop, iOS and Android apps, `app.paseo.sh` and the `paseo` CLI are upstream builds. They
connect to our daemon and MUST keep working.

- The version string MUST stay upstream's. Clients compare it, and a made-up version breaks their update
  prompts and capability checks.
- Wire changes MUST follow upstream's `docs/protocol-compatibility.md`: new fields are `.optional()`, new
  RPCs follow `docs/rpc-namespacing.md`, and each new feature gets its own flag in `server_info.features`.
  Existing message shapes, auth, pairing and the relay MUST NOT change.
- App changes only reach the web UI that our daemon serves; upstream's native apps never get them. So a
  daemon change MUST NOT need our app changes, and app changes MUST check the capability flag.
- Before committing a changed series, `pnpm build`, connect at least one upstream client (an official app or
  `app.paseo.sh`) to the rebuilt daemon and check that agents, terminals and history still work. Note what
  you checked in the ledger's Compatibility line.

### Moving to a new upstream release

Use upstream **release tags**, not `main`, so the daemon we run matches a version the apps know.

1. `pnpm vendor:upgrade paseo` checks out the newest stable tag (`vX.Y.Z`, no prereleases) in `vendor/paseo`.
2. `pnpm paseo:edit` replays the series onto it with `git am --3way`. If a patch stops on a conflict, fix it
   in `.cache/paseo-work`, `git add`, `git am --continue`, and repeat. If upstream now does the same thing,
   `git am --skip` that patch and mark the ledger entry upstreamed.
3. `package-lock.json` conflict: take the new release's file (`git checkout --ours package-lock.json`; in
   `git am`, "ours" is the release), run `npm install` to apply the patch's dependency change on top, and
   `git add` it before `git am --continue`.
4. Run upstream's checks, then `pnpm paseo:export`.
5. If upstream's `NODE_IMAGE` default changed, move `services/toolchain/Dockerfile` to its tag. Either way,
   bump the digest pinned there to the tag's current one. This rebuilds every image, so do it only here.
6. `pnpm build`, the client check above, then one commit `chore(paseo): move to vX.Y.Z` with the submodule
   bump, the refreshed patches, the node digest and the ledger's Base and Sync log.

### Shipping a change

1. Add the `F-<n>` entry to the ledger.
2. `pnpm paseo:edit`, commit the change in `.cache/paseo-work` as above, run upstream's checks,
   `pnpm paseo:export`.
3. `pnpm build`, check the clients, then one commit `feat(paseo): <what> (F-<n>)` with the new patch and the
   ledger entry.
4. If the change would help upstream too, open a PR against getpaseo/paseo from a branch in the
   [antfubot/paseo](https://github.com/antfubot/paseo) fork, which exists for upstream PRs only. Put the PR
   link in the entry's Status.
