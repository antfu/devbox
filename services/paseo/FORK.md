# Paseo patches: change ledger

This file lists every change our paseo patch series carries on top of upstream, and why. The rules for keeping
it are in [AGENTS.md](../../AGENTS.md#the-paseo-patches).

- Upstream: [getpaseo/paseo](https://github.com/getpaseo/paseo), checked out at `vendor/paseo`
- Base: `v0.14.0` (the pnpm-install plugin needs 0.14 or newer)
- Series: [patches/](patches), one `git format-patch` file per change, applied in file name order

## Changes

Add each new change at the end with the template at the bottom of this file. Leave `F-<n>` ids as they are:
patches refer to them in their `Fork-Change` trailer.

### F-1: Keep searching when a project icon candidate is rejected

- Status: proposed upstream (https://github.com/getpaseo/paseo/pull/8529)
- Requested: 2026-11-02, "https://github.com/getpaseo/paseo/pull/8529"
- Why: a project with an oversized or non-square first icon match showed no icon, even when a valid one sat
  next to it. Our own upstream PR, carried until it merges.
- Patches: `fix(server): keep searching when a project icon candidate is rejected` (the PR's two commits,
  squashed)
- Touches: `packages/server/src/utils/project-icon.ts` and its test
- Compatibility: daemon-only; no wire or client change.
- Drop when: upstream merges #8529 and we rebase onto a release that has it.

### F-2: Drop the New workspace row under an empty project

- Status: active, ours only
- Requested: 2026-11-02, "remove the redundant \"new workspace\" entry of the list of sessions of each project"
- Why: an expanded project with no workspaces showed a "New workspace" row that opens the same screen as the
  project header's `+` button.
- Patches: `feat(app): drop the New workspace row under an empty project`
- Touches: `packages/app/src/components/sidebar-workspace-list.tsx` (removes `NewWorkspaceGhostRow` and its
  styles), `packages/app/e2e/browser/empty-project-persists.spec.ts`
- Compatibility: web UI only; no wire change. On desktop web the `+` shows on hover, as for projects with
  workspaces.
- Drop when: never, unless upstream removes the row.

### F-3: Host default permission mode per provider

- Status: active, ours only
- Requested: 2026-11-02, "have the settings panel for setting defaults permissions mode/defualt project setup
  script" (confirmed: the host default wins over the mode a device remembered)
- Why: Paseo only remembers the last mode picked, per device, and each provider's default is fixed (Claude
  `auto`, Codex `auto-review`). The container is the isolation here, so we want new agents in bypass mode
  everywhere without picking it on every device.
- Patches: `feat: add a host default permission mode per provider`
- Touches: protocol `provider-config.ts` (`defaultModeId` on the provider override), `messages.ts`,
  `agent-types.ts`; server new `agent/host-default-mode.ts`, small hooks in `provider-snapshot-manager.ts`;
  app new `provider-selection/host-default-mode.ts` and `screens/settings/provider-default-mode-card.tsx`,
  hooks in `use-agent-form-state.ts` and `host-page.tsx`; one line per non-English locale pointing at the
  English strings (the locale types require every key); regenerated
  `packages/website/public/schemas/paseo.config.v1.json`.
- Compatibility: flag `server_info.features.providerDefaultMode`. New optional fields: `defaultModeId` on the
  daemon config's provider entry (null clears) and `hostDefaultModeId` on provider snapshot entries. The daemon
  also reports the host default as the provider's `defaultModeId`, so upstream apps use it when they remember
  nothing, and applies it to top-level, attended creates that send no mode (CLI, MCP). Subagent inheritance and
  unattended creates are unchanged. A mode the provider no longer offers is ignored.
- Config: Settings → host → Agents → Default mode, saved as `agents.providers.<id>.defaultModeId`.
- Drop when: upstream ships a default mode setting.

### F-4: Host default worktree setup script

- Status: active, ours only
- Requested: 2026-11-02, same request as F-3 ("default project setup script")
- Why: Paseo reads `worktree.setup` only from each repo's committed `paseo.json`. A host default covers every
  project without one (e.g. `pnpm install`), which the pnpm-install plugin does today.
- Patches: `feat: add a host default worktree setup script`
- Touches: protocol `messages.ts`; server new `utils/worktree-default-setup.ts`, one-line hook in
  `utils/worktree.ts` `getWorktreeSetupCommands`, plus `bootstrap.ts`, `config.ts`, `daemon-config-store.ts`,
  `persisted-config.ts` (`worktrees.defaultSetup`); app new `screens/settings/worktree-default-setup.tsx`,
  hooks in `host-page.tsx` and `project-settings-screen.tsx`; one line per non-English locale; the regenerated
  config JSON schema.
- Compatibility: flag `server_info.features.worktreeDefaultSetup`; optional `worktreeDefaultSetup` (null
  clears) on the daemon config. Daemon-side, so it applies to worktrees created from any client. A project whose
  `paseo.json` has `worktree.setup` at all, even empty or unreadable, keeps its own.
- Config: Settings → host → Workspaces, one command per line, saved as `worktrees.defaultSetup`.
- Drop when: upstream ships a global setup default.

### F-5: Stop prompting for a worktree setup script

- Status: active, ours only
- Requested: 2026-11-02, "in the ui, do not pop up for project settings" (confirmed: the sidebar callout)
- Why: the sidebar showed a "no setup script, open project settings" callout for every git project without
  `worktree.setup` in `paseo.json`. With a host default setup script (F-4) that is noise.
- Patches: `feat(app): stop prompting for a worktree setup script`
- Touches: `packages/app/src/app/_layout.tsx` (unmounts the source); deletes
  `packages/app/src/components/worktree-setup-callout-{source.tsx,policy.ts,policy.test.ts}`. The
  `sidebar.worktreeSetup.*` strings stay in the locale files.
- Compatibility: web UI only; no wire change.
- Drop when: never. On rebase, a modify/delete conflict on the deleted files resolves to "deleted".

### F-6: Name a project while adding it

- Status: active, ours only
- Requested: 2026-11-02, "in the \"add new project\" dialogs, an extra step allows setting the project name;
  for example, cloning vitejs/devtools should allow renaming to vite-devtools, so it won't conflict with
  nuxt/devtools" (confirmed: for a clone the name sets the folder and the project name)
- Why: a clone always lands in `<parent>/<repo name>`, so two repos with the same name collide in one parent.
- Patches: `feat: name a project while adding it`
- Touches: protocol `messages.ts`; client `daemon-client.ts` (`cloneGithubProject` takes `directoryName`);
  server new `project-clone-directory.ts`, small hook in `session.ts`; app new
  `add-project-flow/project-name.ts`, edits in `add-project-flow/model.ts`, `components/add-project-flow.tsx`
  (the largest edit: a likely conflict spot), `hooks/use-open-project.ts`; e2e specs and helpers for the extra
  step.
- Compatibility: flag `server_info.features.projectGithubCloneDirectoryName`; optional `directoryName` on
  `project.github.clone.request`, validated as one folder name. Without the flag the clone flow is unchanged.
  For an existing folder the step uses the existing `project.rename.request`, so it works on any host. The
  existing-folder destination is no longer disabled on hosts with the flag, so you can rename into it.
- Drop when: upstream adds naming to the add-project flow.

## Sync log

One line per rebase onto a new upstream base, newest first.

- 2026-11-02: started at `v0.14.0` with F-1 to F-6.

## Entry template

```md
### F-<n>: <short title>

- Status: active, ours only | proposed upstream (<PR link>) | upstreamed in vX.Y.Z (dropped) | dropped (<why>)
- Requested: YYYY-MM-DD, "<the request, in the user's words>"
- Why: <the problem it solves; why config, a plugin or this repo could not solve it>
- Patches: `<type(scope): subject>` (one line per patch, by subject)
- Touches: <packages and files; flag any upstream hot spot>
- Compatibility: <wire impact; why upstream's apps and CLI still work; the `server_info.features` flag if any>
- Drop when: <the condition, e.g. upstream ships an equivalent>
```
