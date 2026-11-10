# Paseo patches: change ledger

This file lists every change our paseo patch series carries on top of upstream, and why. The rules for keeping
it are in [AGENTS.md](../../AGENTS.md#the-paseo-patches).

- Upstream: [getpaseo/paseo](https://github.com/getpaseo/paseo), checked out at `vendor/paseo`
- Base: `v0.15.4`
- Series: [patches/](patches), one `git format-patch` file per change, applied in file name order

## Changes

Add each new change at the end with the template at the bottom of this file. Leave `F-<n>` ids as they are:
patches refer to them in their `Fork-Change` trailer.

### F-1: Better project icon discovery, with a GitHub owner avatar fallback

- Status: active; the discovery part is proposed upstream (https://github.com/getpaseo/paseo/pull/8529), the
  avatar fallback is ours only
- Requested: 2026-11-02, "https://github.com/getpaseo/paseo/pull/8529"; extended 2026-11-04 with F-7's
  request, "merge it into patch 1"
- Why: a project with an oversized or non-square first icon match showed no icon, even when a valid one sat
  next to it (our upstream PR, carried until it merges). A project with no icon file at all showed only its
  initial; icon resolution happens in the daemon, which no plugin hook reaches.
- Patches: `fix(server): keep searching when a project icon candidate is rejected` (the PR's two commits plus
  the avatar fallback, squashed)
- Touches: `packages/server/src/utils/project-icon.ts` and its test; new `utils/project-github-avatar.ts` and
  its test; a two-line hook in `utils/project-custom-icon.ts` `readProjectIconSnapshot`
- Compatibility: daemon-only; no wire or client change. The avatar is served as an ordinary automatic icon with
  its own revision, so every client, upstream apps included, shows it. Order: custom icon, then local icon
  files, then the avatar. Only projects whose project key is a GitHub remote (`remote:github.com/...`) are
  fetched, from `github.com/<owner>.png?size=64`, with a 10 s timeout, cached in memory per owner (a day when
  the owner is found or missing, one minute after a failure). Offline, it falls back to the initial as before.
  The timeout was 3 s until v0.15.4, whose heavier startup pushed the first fetch past it; each session keeps
  the icon it first resolved, so the avatar stayed missing until the client reconnected.
  Checked: unit tests and a live fetch only; the rebuilt image and an upstream client are not checked yet.
- Drop when: upstream merges #8529 and ships a remote-avatar fallback. If only #8529 lands, drop the PR's part
  on rebase and keep the avatar files and the hook in `project-custom-icon.ts`.

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
  project without one (e.g. `pnpm install`).
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

### F-7: Fall back to the GitHub owner's avatar for project icons

- Status: merged into F-1 (its patch now carries the change)
- Requested: 2026-11-04, "the project icon resolve should eventually fallback to the github owner's avatar,
  nuxt/devtools -> github.com/nuxt.png, if they are github projects"
- Why: see F-1.
- Patches: none of its own; see F-1.
- Drop when: see F-1.

### F-8: Subdomain wildcards in the CORS origin allowlist

- Status: active, ours only
- Requested: 2026-11-10, "I couldn't connect mbp-paseo-main.kudu-cardassian.ts.net's server from
  paseo.kudu-cardassian.ts.net, maybe some origin check? fix this", then "can we make it support any
  *.TAILNET_DOMAIN?" and "let's patch paseo to support wildcard"
- Why: with several laptops on one tailnet, each laptop's web UI has its own origin, and a daemon only accepted
  the origins listed in `PASEO_CORS_ORIGINS`, matched exactly. The other choice, `*`, lets any website reach
  the daemon from the browser. The check lives in the daemon, which no plugin hook reaches.
- Patches: `feat(server): accept subdomain wildcards in CORS allowed origins`
- Touches: server new `server/cors-origins.ts` and its test; one-line hooks in `websocket-server.ts`
  `verifyWsUpgrade` and in the CORS middleware in `bootstrap.ts`
- Compatibility: daemon-only; no wire or client change, no feature flag. Exact entries and `*` behave as
  before. `https://*.<domain>` matches any subdomain of `<domain>` on that scheme and port, not the domain
  itself. Config: `PASEO_CORS_ORIGINS=https://*.<tailnet>` in `dev-container.config.ts`.
  Checked: unit tests only; the rebuilt image and an upstream client are not checked yet.
- Drop when: upstream supports wildcard origins.

### F-9: Host icon, shown with the host's color in every host list

- Status: active, ours only
- Requested: 2026-11-10, "patch paseo to support changing host icon as well in the config. in the host
  dropdown, it should render with host's icon and color."; extended the same day, "in the dropdown
  menu of the workspaces, it should also respect the host icon and color, compose the icon with host
  status on the right bottom corner, hide status when the host is connected. and same for the \"choose
  host\" command palette, and the Host dropdown in the settings."
- Why: a host's appearance had only a name and a color, and host lists showed only a status dot, so
  hosts with similar names (one per laptop) were hard to tell apart. Host appearance lives in the app,
  which no plugin hook reaches.
- Patches: `feat(app): pick a host icon and show it in host pickers`
- Touches: app new `hosts/host-icons.ts` (the icon set), `components/hosts/host-identity-icon.tsx`,
  `screens/settings/host-icon-row.tsx`; small hooks in `hosts/appearance.ts` (optional `icon`) and its
  test, `hosts/host-badge.tsx`, `runtime/host-runtime.ts` (`setHostIcon`),
  `components/hosts/host-picker.tsx` (`HostStatusDotSlot`), `screens/new-workspace/form/index.tsx`,
  `screens/settings/host-appearance-section.tsx`, `components/sidebar/display-preferences/menu.tsx`
  (the sidebar's host filter), `screens/settings-screen.tsx` (the settings host switcher),
  `components/add-project-flow.tsx` (a `leading` slot on rows, used by the Choose host step); a comment
  in `e2e/support/helpers/hosts.ts`; `en.ts` strings and one line per other locale.
- Compatibility: web UI only; no wire or daemon change, so no feature flag. The icon is per-device, next
  to the color, and optional in the stored host registry, so registries saved before it still parse.
  Every host list draws `HostIdentityIcon`: the host's icon in its color (the server glyph, muted, by
  default), with the status dot on its bottom-right corner only while the host is not connected.
  `HostStatusDotSlot` draws it, so the lists that use the slot (new workspace, host filter trigger, host
  chooser, schedules) get it too. Checked: typecheck and unit tests only; not checked in a browser yet.
- Config: Settings → host → Appearance → Icon.
- Drop when: upstream ships host icons.

### F-10: Pull request pill and follow-up actions above the composer

- Status: active, ours only
- Requested: 2026-11-10, "have the top nav of the session render the pr link, pr status, and diffs.
  clicking on the diffs open the diffs tab."; then, the same day, "instead, for the diff pill above the
  prompt input, add new pills for pr, and if the pr has conflicts, add a \"resolve conflicts\" button
  that for quick action of sending prompts, and for failed prs \"fix ci\". for finished task that has
  local diffs but no prs, add \"create pr\" button."; extended 2026-11-10, "for the on top of prompt
  input, add a icon (light-bulb or zap?) for the quick actions" and "for the pr status indiactor, show
  the conflicts icon when conflicts are detected"
- Why: the composer's pill row showed the diff stat but not the change request, and acting on a
  conflicted or failing one meant typing the same prompt each time. The composer is app UI; plugin
  composer pills cannot read the workspace's change request state or send a prompt to the agent.
- Patches: `feat(app): show the pull request and its follow-ups above the composer`
- Touches: app new `composer/pull-request-actions.ts` (which follow-ups apply) and its test,
  `composer/pull-request-pills.tsx`; a small hook in `panels/agent-tracks.tsx` (renders the pills after
  the diff stat pill, and counts them when deciding whether the row shows); `en.ts` strings
  (`workspace.git.pr.quickActions`) and one line per other locale. The conflict glyph: `git/pr-hint.ts`
  (`hasConflicts`) and its test, `git/pull-request-state-icon.tsx` (optional `hasConflicts`), and a one-prop
  edit at its call sites in `composer/pull-request-pills.tsx`, `components/sidebar-workspace-list.tsx` and
  `components/sidebar/workspace-meta-row/index.tsx`.
- Compatibility: web UI only; no wire or daemon change, so no feature flag. It reads the workspace's
  existing `githubRuntime.pullRequest` (state, `mergeable`, checks, `baseRefName`) and `diffStat`. A
  follow-up sends an ordinary agent message, the same call the composer makes. Follow-ups only show while
  the agent is idle, so they never interrupt a turn: "Resolve conflicts" when an open change request is
  `CONFLICTING`, "Fix CI" when one of its checks failed, "Create PR" for local changes with no change
  request. Each follow-up pill leads with a Zap icon. An open change request whose `mergeable` is
  `CONFLICTING` shows an amber warning triangle in place of its state glyph, in the composer pill and in
  the sidebar rows. The prompt texts are in `en.ts`; F-14 lets you replace them. Checked: typecheck, lint
  and the unit tests only; not checked in a browser yet.
- Drop when: upstream shows the change request and its follow-ups in the composer.

### F-11: Clone a project from another connected host

- Status: active, ours only
- Requested: 2026-11-10, "a new patch for \"add project\", that when there are other host connnect,
  support \"Clone from other host\", that get the project info and clone."
- Why: moving a project to another machine meant finding its remote URL on the first host and pasting it
  into "Clone from GitHub" on the second. The Add project flow is app UI, which no plugin hook reaches.
- Patches: `feat(app): clone a project from another connected host`
- Touches: app new `add-project-flow/other-host-projects.ts` and its test; `add-project-flow/model.ts`
  (an `other-host-projects` page and its opener); `components/add-project-flow.tsx` (the method row,
  the page's title, placeholder, empty text and rows; a hot spot shared with F-6).
- Compatibility: web UI only; no wire or daemon change, so no feature flag. The list comes from the
  session data the app already holds for every connected host: each git project's remote is taken from
  one of its workspaces (`gitRuntime.remoteUrl`), or else from its `remote:` project key. Projects the
  target host already has (same project key) are left out. Picking one continues with the existing
  clone steps, so it needs the target host's `projectGithubClone` feature, like "Clone from GitHub".
  Shown only when another host is connected. Checked: typecheck, lint and unit tests only; not checked
  in a browser yet.
- Drop when: upstream adds cloning from another host.

### F-12: Select a question option by clicking anywhere on its row

- Status: active, ours only
- Requested: 2026-11-10, "for the question tool, allow clicking on the entire item to select, not only
  the raido button"
- Why: a click on an option's description did nothing, because the description claimed every touch so
  its text could be selected. The question card is app UI, which no plugin hook reaches.
- Patches: `feat(app): select a question option by clicking anywhere on its row`
- Touches: `packages/app/src/components/question-form-card.tsx` (`isNonAnsweringClick` and the
  description's responder) and its browser test.
- Compatibility: web UI only; no wire change. On web a plain click on the description now answers; a
  link, a drag that selected description text, and the second click of a double-click still do not
  (upstream's e2e `question-prompt-pagination.spec.ts` covers those). Native is unchanged. Checked:
  typecheck and lint; the browser test is written but its run is still pending.
- Drop when: upstream lets the whole option row answer.

### F-13: Set up the selected project on a host that lacks it, from New workspace

- Status: active, ours only
- Requested: 2026-11-10, "in \"new workspace\" panel, in the host select dropdown, add (project not
  exists), with a button on the right for \"Setup\"."
- Why: a host without the selected project looked like any other host in New workspace's host picker.
  The picker and Add project are app UI, which no plugin hook reaches.
- Patches: `feat(app): offer to set up the project on a host that lacks it`
- Touches: app `components/hosts/host-picker.tsx` (optional `hostOptionExtras`: a per-host note and an
  action button); `screens/new-workspace/form/index.tsx` (supplies them);
  `stores/add-project-flow-store.ts` and `add-project-flow/model.ts` (open on "Clone from other host"
  with a query); `components/add-project-flow.tsx` (passes it through); the model test; `en.ts` strings
  and one line per other locale.
- Compatibility: web UI only; no wire or daemon change, so no feature flag. Builds on F-11: Setup opens
  Add project on that host at "Clone from other host", searching for the project's name, and Back goes
  to the host's methods. Checked: typecheck, lint and unit tests only; not checked in a browser yet.
- Drop when: upstream offers to set up a project on another host; drop together with F-11.

## Sync log

One line per rebase onto a new upstream base, newest first.

- 2026-11-10: moved to `v0.15.4`; all 12 patches (F-1 to F-6, F-8 to F-13) applied with `git am --3way`
  and no conflicts, and none is upstreamed yet ([#8529](https://github.com/getpaseo/paseo/pull/8529) is still open).
  F-4's config fields moved into `worktreeDefaultSetupField`, because upstream's new fields pushed two
  config builders past the lint complexity limit.
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
