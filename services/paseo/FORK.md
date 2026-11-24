# Paseo patches: change ledger

This file lists every change our paseo patch series carries on top of upstream, and why. The rules for keeping
it are in [AGENTS.md](../../AGENTS.md#the-paseo-patches).

- Upstream: [getpaseo/paseo](https://github.com/getpaseo/paseo), checked out at `vendor/paseo`
- Base: `v0.16.1`
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
- Patches: `feat: add host defaults for new agents and worktrees` (also carries F-4, from the same request)
- Touches: protocol `provider-config.ts` (`defaultModeId` on the provider override), `messages.ts`,
  `agent-types.ts`; server new `agent/host-default-mode.ts`, small hooks in `provider-snapshot-manager.ts`
  and `agent-sdk-types.ts`, the flag in `websocket-server.ts`, `daemon-config-store.test.ts`;
  app new `provider-selection/host-default-mode.ts` and `screens/settings/provider-default-mode-card.tsx`,
  hooks in `use-agent-form-state.ts` (the form store's `providerPreferences` catalog entry, the resolution
  preferences and `applyProfileFromUser`) and `host-page.tsx`; one line per non-English locale pointing at
  the English strings (the locale types require every key); regenerated
  `packages/website/public/schemas/paseo.config.v1.json`.
- Compatibility: flag `server_info.features.providerDefaultMode`. New optional fields: `defaultModeId` on the
  daemon config's provider entry (null clears) and `hostDefaultModeId` on provider snapshot entries. The daemon
  also reports the host default as the provider's `defaultModeId`, so upstream apps use it when they remember
  nothing, and applies it to top-level, attended creates that send no mode (CLI, MCP). Subagent inheritance and
  unattended creates are unchanged. A mode the provider no longer offers is ignored.
- Config: Settings → host → Agents → Default mode, saved as `agents.providers.<id>.defaultModeId`.
- Drop when: upstream ships a default mode setting. If upstream ships only one of this and F-4, drop that
  part of the patch on rebase and keep the other.

### F-4: Host default worktree setup script

- Status: active, merged into F-3's patch on 2026-11-12 (same request, seven shared files)
- Requested: 2026-11-02, same request as F-3 ("default project setup script")
- Why: Paseo reads `worktree.setup` only from each repo's committed `paseo.json`. A host default covers every
  project without one (e.g. `pnpm install`).
- Patches: none of its own; F-3's `feat: add host defaults for new agents and worktrees` carries it.
- Touches: protocol `messages.ts`; server new `utils/worktree-default-setup.ts`, one-line hook in
  `utils/worktree.ts` `getWorktreeSetupCommands`, plus `bootstrap.ts`, `config.ts`, `daemon-config-store.ts`
  and its test, `persisted-config.ts` (`worktrees.defaultSetup`), the flag in `websocket-server.ts`; app new `screens/settings/worktree-default-setup.tsx`,
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
- Touches: protocol `messages.ts` and two of its tests; client `daemon-client.ts` (`cloneGithubProject` takes
  `directoryName`) and its test; server new `project-clone-directory.ts`, small hook in `session.ts`, the flag
  in `websocket-server.ts`; app new `add-project-flow/project-name.ts`, edits in `add-project-flow/model.ts`,
  `components/add-project-flow.tsx` (the largest edit: a likely conflict spot), `hooks/open-project.ts` and
  `hooks/use-open-project.ts`; e2e specs and helpers for the extra step.
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
- Touches: app new `hosts/host-icons.ts` (the icon set), `hosts/host-icon-store.ts` (where icons are saved)
  and its test, `components/hosts/host-identity-icon.tsx`, `screens/settings/host-icon-row.tsx`; small hooks
  in `hosts/appearance.ts` (the legacy `icon` field), `hosts/host-badge.tsx`, `runtime/host-runtime.ts`
  (one `adoptHostIcons` call in `loadFromStorage`),
  `components/hosts/host-picker.tsx` (`HostStatusDotSlot`), `screens/new-workspace/form/index.tsx`,
  `screens/settings/host-appearance-section.tsx`, `components/hosts/host-menu-item.tsx` (the sidebar's
  host filter and the usage host menu), `screens/settings-screen.tsx` (the settings host switcher),
  `components/add-project-flow.tsx` (a `leading` slot on rows, used by the Choose host step); a comment
  in `e2e/support/helpers/hosts.ts`; `en.ts` strings and one line per other locale.
- Compatibility: web UI only; no wire or daemon change, so no feature flag. The icon is per-device, like
  the color, saved under its own storage key, `@paseo:host-icons`, not in the host registry: the registry's
  schema is strict and a registry that fails it is deleted whole, so an icon there would cost every saved
  host on a build without this patch (an upstream web UI on the same origin, or after dropping F-9). Until
  2026-11-12 the icon was in the registry; `appearance.icon` stays accepted as any string
  (`COMPAT(hostIconRegistry)`, remove after 2027-05-12), and loading the registry moves it to the new key
  and saves the registry without it. An unknown icon name is dropped, not fatal.
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
- Patches: `feat(app): show the pull request and its follow-ups above the composer` (also carries F-14)
- Touches: app new `composer/pull-request-actions.ts` (which follow-ups apply) and its test,
  `composer/pull-request-pills.tsx`; a small hook in `panels/agent-tracks.tsx` (renders the pills after
  the diff stat pill; since v0.16.0 the track bar is always mounted, so there is no visibility count);
  `en.ts` strings (`workspace.git.pr.quickActions`) and one line per other locale. The conflict glyph:
  `git/pr-hint.ts` (`hasConflicts`) and its test, `git/pull-request-state-icon.tsx` (optional
  `hasConflicts`), and a one-prop edit at its call sites in `composer/pull-request-pills.tsx`,
  `components/sidebar-workspace-list.tsx` and `components/sidebar/workspace-meta-row/index.tsx`.
- Compatibility: web UI only; no wire or daemon change, so no feature flag. It reads the workspace's
  existing `githubRuntime.pullRequest` (state, `mergeable`, checks, `baseRefName`) and `diffStat`. A
  follow-up sends an ordinary agent message, the same call the composer makes. Follow-ups only show while
  the agent is idle, so they never interrupt a turn: "Resolve conflicts" when an open change request is
  `CONFLICTING`, "Fix CI" when one of its checks failed, "Create PR" for local changes with no change
  request. Each follow-up pill leads with a Zap icon. An open change request whose `mergeable` is
  `CONFLICTING` shows an amber warning triangle in place of its state glyph, in the composer pill and in
  the sidebar rows. The prompt texts are in `en.ts`; F-14 lets you replace them. Checked: typecheck, lint
  and the unit tests only; not checked in a browser yet.
- Drop when: upstream shows the change request and its follow-ups in the composer. F-14 goes with it.

### F-11: Clone a project from another connected host

- Status: active, ours only
- Requested: 2026-11-10, "a new patch for \"add project\", that when there are other host connnect,
  support \"Clone from other host\", that get the project info and clone."
- Why: moving a project to another machine meant finding its remote URL on the first host and pasting it
  into "Clone from GitHub" on the second. The Add project flow is app UI, which no plugin hook reaches.
- Patches: `feat(app): clone a project from another connected host` (also carries F-13)
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
  It needs F-9's `HostIdentityIcon` and the `leading` row slot of `add-project-flow.tsx`.
- Drop when: upstream adds cloning from another host. F-13 goes with it.

### F-12: Select a question option by clicking anywhere on its row

- Status: upstreamed in v0.16.0 (dropped); [#8525](https://github.com/getpaseo/paseo/pull/8525) lets a click
  on the description answer, on web and native. Upstream still answers a click that ends a text drag on the
  description, which our patch skipped.
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

- Status: active, merged into F-11's patch on 2026-11-12 (it builds on F-11)
- Requested: 2026-11-10, "in \"new workspace\" panel, in the host select dropdown, add (project not
  exists), with a button on the right for \"Setup\"."
- Why: a host without the selected project looked like any other host in New workspace's host picker.
  The picker and Add project are app UI, which no plugin hook reaches.
- Patches: none of its own; F-11's `feat(app): clone a project from another connected host` carries it.
- Touches: app `components/hosts/host-picker.tsx` (optional `hostOptionExtras`: a per-host note and an
  action button); `screens/new-workspace/form/index.tsx` (supplies them);
  `stores/add-project-flow-store.ts` and `add-project-flow/model.ts` (open on "Clone from other host"
  with a query); `components/add-project-flow.tsx` (passes it through); the model test; `en.ts` strings
  and one line per other locale.
- Compatibility: web UI only; no wire or daemon change, so no feature flag. Builds on F-11: Setup opens
  Add project on that host at "Clone from other host", searching for the project's name, and Back goes
  to the host's methods. Setup shows only for online hosts, since Add project lists only those; an
  offline host still says the project is missing. Checked: typecheck, lint and unit tests only; not
  checked in a browser yet.
- Drop when: upstream offers to set up a project on another host; drop together with F-11.

### F-14: Customize the pull request quick action prompts

- Status: active, merged into F-10's patch on 2026-11-12 (it only extends F-10)
- Requested: 2026-11-10, "add settings page for customize the quick actions prompts."
- Why: F-10's follow-ups always sent the built-in prompt. Settings pages are app UI; a plugin settings
  page could store prompts, but the composer pills (a patch) could not read them.
- Patches: none of its own; F-10's `feat(app): show the pull request and its follow-ups above the composer`
  carries it.
- Touches: app new `composer/quick-action-prompts.ts` (a persisted store, and the `{{url}}`/`{{base}}`
  filler) and its test, `screens/settings/quick-actions-section.tsx`; hooks in
  `composer/pull-request-pills.tsx` (F-10's file), `screens/settings-screen.tsx` (a sidebar item) and
  `utils/host-routes.ts` (the `quick-actions` slug); `en.ts` strings (`settings.quickActions`,
  `settings.sections.quickActions`) and one line each per other locale.
- Compatibility: web UI only; no wire or daemon change, so no feature flag. The prompts are saved per
  device under their own storage key (`composer-quick-action-prompts`), outside the app settings, so the
  settings schema is unchanged. A blank prompt, or Reset, goes back to the default from `en.ts`.
  Checked: typecheck, lint and unit tests only; not checked in a browser yet.
- Config: Settings → Quick actions.
- Drop when: upstream adds editable quick actions; drop together with F-10.

### F-15: List every host's projects in New workspace

- Status: active, ours only
- Requested: 2026-11-10, "for the project list dropdown in \"new workspace\", merge the projects from all
  the hosts, and on select, reset the host selection to the available one if the current host does not
  have that project."
- Why: the project picker listed only the selected host's projects, so a project on another host
  meant switching host first. The picker is app UI, which no plugin hook reaches.
- Patches: `feat(app): list every host's projects in New workspace`
- Touches: app `screens/new-workspace/project-picker.ts` (`resolveHostForPickedProject`, the listed
  projects, an optional `onSelectHost`) and its test; `project-icon-targets.ts` (icon from another host)
  and its test; a one-line hook in `screens/new-workspace-screen.tsx`.
- Compatibility: web UI only; no wire or daemon change, so no feature flag. Projects are already merged
  across hosts by project key (`useHostProjects`); the picker now lists each one that some connected host
  can create a workspace for. Picking one the selected host lacks selects the first of its hosts that
  can. Selection stays per host, so the rest of the form follows the new host. F-13's host picker still
  marks hosts without the project. Checked: typecheck, lint and unit tests only; not checked in a
  browser yet.
- Drop when: upstream lists projects from every host in New workspace.

### F-16: Queue/steer switch next to the send button

- Status: active, ours only
- Requested: 2026-11-11, "patch paseo, to have the queue/steer switch next to the send button in the
  prompt composer"
- Why: the default send behavior (queue, steer or interrupt while a turn runs) was only in Settings →
  General. The composer toolbar is app UI; plugin composer pills sit above the input, not next to the
  send button.
- Patches: `feat(app): switch between queue and steer next to the send button`
- Touches: app new `composer/send-behavior-switch.tsx` (the button) and
  `composer/send-behavior-switch-model.ts` (`nextSendBehavior`) with its test,
  `send-behavior-switch.test.ts`; a hook in
  `composer/index.tsx` (`beforeVoiceContent` renders it after the context window meter when there is an
  agent; v0.16.0 moved voice mode into the send disc and removed `ComposerRightControlsSlot`).
- Compatibility: web UI only; no wire or daemon change, so no feature flag, and no new strings (it reuses
  the `settings.general.defaultSend` labels and descriptions). It writes the existing `sendBehavior` app
  setting, so Settings and the switch stay in sync. It flips queue ↔ steer; interrupt still comes from
  Settings, shows a zap icon, and goes to queue on press. Checked: typecheck, lint and unit tests only;
  not checked in a browser yet.
- Drop when: upstream puts a send behavior control in the composer.

### F-17: CPU and memory of each host in the host dropdowns

- Status: active, ours only
- Requested: 2026-11-12, "patch in paseo: in the sidebar's bottom, the hosts dropdown, for each host, show
  their CPU and Mem status. same for the \"new workspace\" host dropdown. If there is no api for that,
  improve the container/orbstack/monitor to expose such information"
- Why: upstream has no API for a host's CPU or memory (only free-text diagnostics). The daemon reads them
  itself, so no change to dev-container's monitor was needed: inside a container it reads its own cgroup,
  which gives the numbers `docker stats` shows, and every host already has a daemon connection the app can
  ask. The RPC is in the daemon and the rows are app UI, which no plugin hook reaches.
- Patches: `feat: show each host's CPU and memory in the host pickers`
- Touches: protocol `messages.ts` (`daemon.get_host_stats` request and response, the feature flag); server
  new `server/host-stats.ts` and its test, one case in `session.ts`, two lines in
  `authorization/operation-permissions.ts`, the flag in `websocket-server.ts`; client `getHostStats` in
  `daemon-client.ts`; app new `hosts/host-stats-format.ts` and its test, `hosts/use-host-stats.ts`,
  `components/hosts/host-stats-label.tsx`, a `showHostStats` prop in `components/hosts/host-picker.tsx`,
  and one-line hooks (the prop and a wider menu) in `components/left-sidebar.tsx` and
  `screens/new-workspace/form/index.tsx`.
- Compatibility: flag `server_info.features.hostStats`. A new dotted RPC, `daemon.get_host_stats`, with
  `daemon.read` permission; no existing message changes. Upstream apps never send it. Our app polls it every
  3 s, only while a host dropdown is open and only for connected hosts that advertise the flag; other hosts
  show no stats. CPU is the busy share of the CPUs the host can use (the cgroup's `cpu.max` limit, or all
  cores), averaged since the previous read, or over 250 ms when there is none or it is over a minute old.
  Memory in a container is `memory.current` minus `inactive_file`, out of `memory.max` or the VM's memory.
  The cgroup is used only when the daemon is at its cgroup namespace root (`/proc/self/cgroup` is `0::/`);
  elsewhere (macOS, a bare Linux host) the OS totals apply, and macOS counts cache as used.
  Checked: typecheck, lint and unit tests only; not checked in a browser yet.
- Drop when: upstream reports host resource use.

### F-18: Copy and paste host configs

- Status: active, ours only
- Requested: 2026-11-16, "patch paseo, to allow copy/paste the all host configures (links, port, password,
  host name, color, icon, settings etc)." (confirmed: device-side host data only, not the daemon's own
  settings; both one host and all hosts)
- Why: a host's connections, password and appearance are saved per device, and the only way to add a host
  elsewhere was to type it in again or pair it. Host storage and the Add host flow are app code, which no
  plugin hook reaches.
- Patches: `feat(app): copy a host config and paste it into Add host`
- Touches: app new `hosts/host-config-transfer.ts` and its test, `hosts/import-host-config.ts`,
  `screens/settings/host-config-copy-section.tsx`; hooks in `components/pair-link-modal.tsx` (a pasted host
  config is previewed and imported instead of paired), `runtime/host-runtime.ts` (`replaceHosts`),
  `hosts/host-icon-store.ts` (`getHostIcons`, `replaceHostIcons`), `screens/settings/host-page.tsx` (the
  section); `en.ts` strings and one line per other locale.
- Compatibility: web UI only; no wire or daemon change, so no flag. Settings → host → Share copies this host
  or every saved host as one line of JSON (`format: "paseo-host-config"`, `version: 1`) holding each host's
  connections, password, name, color, badge display and icon. Routed connections are left out. The text
  holds passwords in the clear. Pasting it into Add host → Paste pairing link adds the hosts, or updates
  the saved ones with the same server id, which keep their other connections. Hosts are validated with the
  registry's own `normalizeStoredHostProfile`; an invalid host is skipped. The import skips the pairing
  link's confirmation; the preview line ("Adds or updates N hosts: …") and the Import button take its place.
  Checked: typecheck, lint and unit tests only; not checked in a browser yet.
- Drop when: upstream ships host export and import.

### F-19: Name, color and icon in the Direct connection form

- Status: active, ours only
- Requested: 2026-11-16, "also on normal add host form, allow to set name,color,icon before creating."
- Why: a new host showed its hostname and the default look until you opened its settings. The form is app
  code, which no plugin hook reaches.
- Patches: `feat(app): pick a host's name, color and icon while adding it`
- Touches: app new `hosts/add-host/internal/add-host-identity-fields.tsx`; hooks in
  `hosts/add-host/internal/add-host-modal.tsx` (the
  fields, applied after a direct or relay connect), `screens/settings/host-appearance-section.tsx`
  (`ColorRow` exported; the formatter split its signature); `en.ts` string and one line per other locale.
- Compatibility: web UI only; no wire change. The values are saved with the existing rename, color and F-9
  icon setters once the host connects; empty values keep the host's own name and the default look. Only
  the Direct connection form has them; the SSH and pairing link forms do not.
  Checked: typecheck and lint only; not checked in a browser yet.
- Drop when: upstream adds appearance fields to Add host.

### F-20: Host list synced through the daemon that serves the web app

- Status: active, ours only
- Requested: 2026-11-16, "also, can we have the daemon store the host settings (for our paseo-app), so any
  devices open the same paseo app, they get the host automatically (and auto-synced)" (confirmed: the
  serving daemon holds the list; a full mirror, removals included)
- Why: each browser kept its own host list, so every device had to add every host, and a change on one
  device never reached the others. Storing it needs a daemon RPC and the sync is app code; neither is
  reachable from a plugin.
- Patches: `feat: sync the web app's host list through the daemon that serves it`
- Touches: protocol `messages.ts` (`daemon.app_host_registry.get` and `.set` requests and responses, the
  flag); server new `server/app-host-registry.ts` and its test, one case in `session.ts`
  (`dispatchMiscMessage`, as `dispatchAgentConfigMessage` was at the complexity limit), four lines in
  `authorization/operation-permissions.ts`, the flag in `websocket-server.ts`; client `getAppHostRegistry`
  and `setAppHostRegistry` in `daemon-client.ts`; app new `hosts/serving-daemon.ts`,
  `hosts/host-registry-sync-model.ts` and its test, `hosts/host-registry-sync.ts`; hooks in `app/_layout.tsx`
  (mounts `HostRegistrySync`), `hosts/add-host/internal/add-host-modal.tsx` (the prefill),
  `hosts/host-icon-store.ts` (`subscribeHostIcons`).
- Compatibility: flag `server_info.features.appHostRegistry`. Two new dotted RPCs, both `daemon.manage`
  because the list holds passwords; no existing message changes. Upstream apps never send them. The daemon
  stores `$PASEO_HOME/app-host-registry.json` (`{ revision, config }`, at most 1 MiB) and does not read the
  config, which is F-18's host config text. A write is saved only when its `baseRevision` is the stored
  revision; otherwise the stored list comes back to merge. Only our web UI syncs, and only with the daemon
  that served the page, found through its unauthenticated `/api/status` (`serverId`); app.paseo.sh, the
  desktop app and native builds never match one. While that host is saved and connected, the app polls every
  5 s and 300 ms after each local change, merges per host against the list it last agreed on (kept in
  `@paseo:host-registry-sync`), applies the result and saves it back. Conflicts on one host go to the local
  side, except on a device's first sync, which takes the daemon's copy and adds the device's other hosts.
  Hosts with only routed connections are not synced and stay. Without a saved serving host, Direct
  connection is prefilled with the page's address, port and TLS. The daemon serving our web UI is the
  `paseo` client service, so it holds the list for `paseo-bot` and `paseo-main` too.
  Checked: typecheck, lint, the unit tests and the server's authorization test only; not checked in a
  browser or against an upstream client yet.
- Drop when: upstream syncs hosts between devices.

### F-21: Every pull request of an agent and its subagents above the composer

- Status: active, ours only
- Requested: 2026-11-19, "support detecting and displaying multiple prs if the agent or its sub agents is
  working on mutiple prs." (confirmed: the PRs of the workspaces its subagents run in, plus the PR links the
  agent or a subagent created with `gh pr create` or the like)
- Why: F-10 shows the one change request of the workspace's branch. An agent that opens several, or hands
  work to subagents in other worktrees, had the rest out of sight. Which change requests an agent created is
  only in its tool calls, which the daemon sees and no plugin composer pill can read.
- Patches: `feat: show every pull request of an agent and its subagents`
- Touches: protocol `messages.ts` (`agent.pull_requests.list` request and response, the flag); server new
  `server/agent-pull-requests/` (`links.ts`, `store.ts`, `index.ts` and tests), one case in `session.ts`
  (`dispatchMiscMessage`), two lines in `authorization/operation-permissions.ts`, the setup and stop in
  `bootstrap.ts`, the flag in `websocket-server.ts`; client `listAgentPullRequests` in `daemon-client.ts`;
  app new `composer/agent-pull-requests.ts` and its test, and `composer/pull-request-pills.tsx` (F-10's
  file) now renders one pill per change request.
- Compatibility: flag `server_info.features.agentPullRequests`. One new dotted request/response pair
  (`workspace.read`); no existing message changes and the daemon never sends anything unasked, so upstream
  apps and the CLI see no difference. An agent holds the change request of the branch checked out where it
  runs (upstream's own snapshot) and every change request a finished tool call of its created: a shell
  command matching `gh|glab|tea|fj|berg pr|mr|pulls create|new`, or an MCP tool named like
  `create_pull_request`. Links a command only read (`gh pr list`) do not count. Claude, Codex and OpenCode
  provider subagents count as their parent. Links are kept in `$PASEO_HOME/agent-pull-requests.json`, since
  an archived subagent's timeline is not loaded again, and are dropped when the agent is deleted. The list
  for an agent covers all of its subagents, archived ones included. A link's status is read through the
  forge of a checkout on the same repository; a link into a repository none of the agents has checked out
  is listed with state `unknown` and shown as an open pill without checks. The app refetches every 30
  seconds; the workspace's own change request still arrives by push and is shown first. With more than one
  change request, a follow-up pill names its number ("Fix CI #12"). A link no checkout's forge knows is
  asked again every 10 minutes, not on every list request. Checked: typecheck (protocol, client, server,
  app), lint, format, the unit tests, and the builds upstream's Dockerfile runs (`build` for server and
  CLI, `build:daemon-web-ui`), outside Docker; not checked in a browser or against an upstream client yet.
  After F-22 was taken out on 2026-11-24: typecheck (protocol, client, server, app), lint, format and the
  touched unit tests again; no `pnpm build`, since that session had no Docker.
- Drop when: upstream shows the change requests of an agent's subagents.

### F-22: Listen to an agent's pull requests and answer reviews, failed CI and conflicts

- Status: dropped on 2026-11-24 ("remove auto listen feature patch"); its parts, including the Address
  review quick action and the prompt sync, are gone from F-21's patch. Saved prompts in
  `agent-pull-requests.json` are ignored on read.
- Requested: 2026-11-19, "support auto listening to PR (a checkbox per session, default on), to auto react to
  reviews and CI reports. prompts reuse the quick actions and respect the customization" (confirmed: it runs
  in the daemon, and reacts to failed CI, new reviews or review comments, and merge conflicts); the same
  day, "make sure the deamon response is backward compatible, as we might using clients without patches
  (paseo's official ios app for example)"
- Why: every review, failed check or conflict needed someone to notice it and click F-10's follow-up. It
  has to work with no client open, so it lives in the daemon; a plugin cannot read forge status or reviews.
- Patches: none (it was carried by F-21's patch, then named `feat: show every pull request of an agent
  and react to their reviews and CI`).
- Touches: protocol `agent-labels.ts` (`paseo.pr-auto-listen`), `messages.ts`
  (`agent.pull_requests.set_prompts`, the flag); server `agent-pull-requests/reactions.ts` and its test,
  the poll in `index.ts`, the prompts in `store.ts`; client `setPullRequestPrompts`; app new
  `composer/quick-action-prompt-sync.tsx` and its test (also mounted in
  `screens/settings/quick-actions-section.tsx`, F-14's file), the checkbox pill in `composer/pull-request-pills.tsx`, the
  `addressReview` action in `composer/pull-request-actions.ts` and `composer/quick-action-prompts.ts`
  (F-10's and F-14's files), `en.ts` strings under `workspace.git.pr.quickActions` (the other locales
  already point at that object).
- Compatibility: flag `server_info.features.pullRequestAutoListen`. One new dotted request/response pair
  (`workspace.write`). The checkbox is the agent label `paseo.pr-auto-listen` (`off` turns it off; absent
  or anything else is on), written with upstream's existing `update_agent_request`, so there is no new
  message for it and other clients only see one more label. **It is on by default for every session,
  including ones started from upstream apps, which have no checkbox**: there, turn it off with the label.
  The follow-up arrives as an ordinary user message, which every client shows. Every 90 seconds the daemon
  reads the open change requests of sessions that listen (F-21's set) and sends at most one follow-up per
  agent per round, only to an idle agent: Resolve conflicts when a change request becomes `CONFLICTING`,
  Fix CI once per failing head commit, Address review for a new review that requests changes, a review
  with a body, or a comment in an unresolved review thread. Approvals and plain conversation comments do
  not count. One agent answers each change request: the one that created it, else the one last written to;
  an archived subagent's go to its nearest unarchived parent. A session listens only while its own
  checkbox and those of all its parents are on, so unchecking a parent also covers its subagents. Guards: the first look after a daemon start
  only notes what is there; Fix CI stops after three failed heads in a row until the checks pass; review
  comments posted during the agent's own turn count as its replies, because the daemon cannot tell the
  agent's forge account from a reviewer's (so a review that arrives mid-turn is not answered on its own;
  the Address review pill still shows for requested changes). What was reacted to is in memory only, so
  events that arrive while the daemon is down are not answered. A follow-up that could not be delivered is
  tried again next round, and one failed forge read does not reset what was waiting (a change request is
  forgotten after 10 rounds without it). Prompts: the daemon's defaults equal `en.ts`. The app sends only
  the prompts this device customized, and an empty one for a prompt reset to its default; the host keeps
  the rest, so devices do not overwrite each other's prompts, and saves them in
  `agent-pull-requests.json`. Checked: typecheck, lint, format, the unit tests and the Dockerfile's builds
  outside Docker; not checked in a browser, against a real forge or against an upstream client yet.
- Config: the Auto-listen checkbox pill above the composer (shown while the session has an open change
  request); prompts in Settings → Quick actions.
- Drop when: upstream reacts to change request events on its own; drop together with F-21.

## Sync log

One line per rebase onto a new upstream base, newest first.

- 2026-11-18: moved to `v0.16.1`; 15 of 16 patches carried. F-12 is upstreamed
  ([#8525](https://github.com/getpaseo/paseo/pull/8525)) and dropped. Conflicts: F-2 (upstream edited the
  removed ghost row), F-3 (`use-agent-form-state.ts` moved to a form store; the host default now goes through
  its `providerPreferences` catalog entry), F-9 (the host filter row became `HostMenuItem`), F-10 (the track
  bar no longer hides itself, so `useHasWorkspacePullRequestPills` is gone), F-16 (the switch moved to
  `beforeVoiceContent`), F-19 and F-20 (the add host modal moved to `hosts/add-host/internal/`).
  F-16's `useKeyboardShortcutsAvailable` is now upstream's `useHardwareKeyboardPresent`.
  [#8529](https://github.com/getpaseo/paseo/pull/8529) is still open. Checked: upstream's format, lint,
  typecheck (protocol, client, server, app) and the touched unit tests; the conflicted commits typecheck on
  their own. Not checked: `pnpm build` and an upstream client, since this session had no Docker.
- 2026-11-12: no base change; merged F-4 into F-3, F-13 into F-11 and F-14 into F-10, which took the series
  from 16 patches to 13. Two fixes came with it: F-13's Setup shows only for online hosts, and F-17 no longer
  renames `trailingSlot` in `host-picker.tsx`.
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
