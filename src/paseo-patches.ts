import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Our paseo changes are a series of `git format-patch` files on top of the upstream release that
 * vendor/paseo pins. Three git worktrees of that submodule hold the states we need:
 * - the submodule itself stays on the pinned release, so its gitlink never records our changes;
 * - the build tree is reset to the release and has the patches applied fresh on every build;
 * - the work tree is where patches are edited, as one commit per patch on the `patches` branch.
 */
export interface PaseoPatchPaths {
  /** The vendor/paseo submodule, checked out at the pinned upstream release. */
  submodule: string
  /** The patch series, applied in file name order. */
  patches: string
  /** Rebuilt from the release and the patches by `prepare`, then used as the Docker build context. */
  buildTree: string
  /** Where `edit` applies the series as commits, and `export` writes them back from. */
  workTree: string
}

const WORK_BRANCH = 'patches'

/** Flags that keep exported patches stable across exports, so only real changes show in a diff. */
const FORMAT_PATCH_FLAGS = [
  '--zero-commit',
  '--no-signature',
  '--no-numbered',
  '--full-index',
]

function git(cwd: string, args: string[], input?: string): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    input,
    stdio: ['pipe', 'pipe', 'inherit'],
  }).trim()
}

function tryGit(cwd: string, args: string[]): boolean {
  try {
    execFileSync('git', args, { cwd, stdio: 'ignore' })
    return true
  }
  catch {
    return false
  }
}

export function listPatches(patches: string): string[] {
  if (!existsSync(patches))
    return []
  return readdirSync(patches)
    .filter(name => name.endsWith('.patch'))
    .sort()
    .map(name => join(patches, name))
}

/** The upstream commit vendor/paseo is checked out at. */
function pinnedCommit(paths: PaseoPatchPaths): string {
  return git(paths.submodule, ['rev-parse', 'HEAD'])
}

/**
 * Shared by all worktrees of the submodule. rerere replays a conflict resolved once on the next rebase of
 * the series. A minimal stat check, because on host mounts (virtiofs on macOS) the inode and ctime git
 * records change under it, and `git am` then rejects files it just wrote as "does not match index".
 */
function configureRepo(paths: PaseoPatchPaths): void {
  git(paths.submodule, ['config', 'rerere.enabled', 'true'])
  git(paths.submodule, ['config', 'core.checkStat', 'minimal'])
}

/** A worktree whose folder was deleted by hand is still registered; drop it so it can be added again. */
function ensureWorktree(paths: PaseoPatchPaths, dir: string, options: string[], commit: string): void {
  configureRepo(paths)
  if (existsSync(join(dir, '.git')))
    return
  git(paths.submodule, ['worktree', 'prune'])
  git(paths.submodule, [
    'worktree',
    'add',
    '--quiet',
    ...options,
    dir,
    commit,
  ])
}

/**
 * Reset the build tree to the pinned release and apply every patch. It fails on the first patch that
 * does not apply cleanly; `edit` is where conflicts get resolved.
 */
export function prepareBuildTree(paths: PaseoPatchPaths): string[] {
  const pinned = pinnedCommit(paths)
  ensureWorktree(paths, paths.buildTree, ['--detach'], pinned)
  git(paths.buildTree, ['reset', '--quiet', '--hard', pinned])
  git(paths.buildTree, ['clean', '--quiet', '-fdx'])
  const series = listPatches(paths.patches)
  for (const patch of series) {
    if (!tryGit(paths.buildTree, ['apply', '--whitespace=nowarn', patch]))
      throw new Error(`${patch} does not apply to ${pinned.slice(0, 12)}. Run \`pnpm paseo:edit\` to rebase the series.`)
  }
  return series
}

/** Patch ids ignore line numbers and hashes, so they say whether a commit and a patch file are the same change. */
function patchId(cwd: string, diff: string): string {
  return git(cwd, ['patch-id', '--stable'], diff).split(' ')[0] ?? ''
}

function workCommits(paths: PaseoPatchPaths, base: string): string[] {
  const out = git(paths.workTree, ['rev-list', '--reverse', `${base}..HEAD`])
  return out
    ? out.split('\n')
    : []
}

function isDirty(cwd: string): boolean {
  return git(cwd, ['status', '--porcelain', '--untracked-files=no']) !== ''
}

/** A `git am` or rebase stopped on a conflict. */
function isApplying(cwd: string): boolean {
  return ['rebase-apply', 'rebase-merge'].some(name =>
    existsSync(git(cwd, [
      'rev-parse',
      '--path-format=absolute',
      '--git-path',
      name,
    ])))
}

/**
 * True when the work tree holds exactly the exported series, so recreating it loses nothing.
 * Compared by patch id, as a rebase onto a new release changes hashes and line numbers.
 */
export function isWorkTreeExported(paths: PaseoPatchPaths): boolean {
  if (isDirty(paths.workTree) || isApplying(paths.workTree))
    return false
  const base = git(paths.workTree, [
    'merge-base',
    'HEAD',
    pinnedCommit(paths),
  ])
  const commits = workCommits(paths, base).map(commit => patchId(paths.workTree, git(paths.workTree, ['show', commit])))
  const files = listPatches(paths.patches).map(patch => patchId(paths.workTree, readFileSync(patch, 'utf8')))
  return commits.length === files.length && commits.every((id, index) => id === files[index])
}

export type EditResult = { kind: 'ready', commits: number } | { kind: 'conflict' }

/**
 * Put the series on the pinned release as commits on the `patches` branch of the work tree. Untracked
 * files such as node_modules survive, so the tree stays ready for upstream's checks. It refuses to run
 * over work that is not exported yet, unless forced.
 */
export function startEditing(paths: PaseoPatchPaths, force = false): EditResult {
  const pinned = pinnedCommit(paths)
  if (existsSync(join(paths.workTree, '.git')) && !force && !isWorkTreeExported(paths))
    throw new Error(`${paths.workTree} has changes that are not exported. Run \`pnpm paseo:export\`, or pass --force to drop them.`)
  ensureWorktree(paths, paths.workTree, ['-B', WORK_BRANCH], pinned)
  if (isApplying(paths.workTree))
    tryGit(paths.workTree, ['am', '--abort'])
  git(paths.workTree, [
    'checkout',
    '--quiet',
    '--force',
    '-B',
    WORK_BRANCH,
    pinned,
  ])
  // Files the checkout rewrote within the same second as the index look modified to `git am`
  // ("does not match index"); a refresh rereads their content.
  git(paths.workTree, ['update-index', '-q', '--refresh'])
  const series = listPatches(paths.patches)
  if (series.length > 0 && !tryGit(paths.workTree, ['am', '--quiet', '--3way', ...series]))
    return { kind: 'conflict' }
  return { kind: 'ready', commits: series.length }
}

/** Write each commit on the work branch since the pinned release back as one patch file. */
export function exportPatches(paths: PaseoPatchPaths): string[] {
  const pinned = pinnedCommit(paths)
  if (isApplying(paths.workTree))
    throw new Error('A `git am` is still in progress in the work tree. Finish it with `git am --continue` first.')
  if (isDirty(paths.workTree))
    throw new Error('The work tree has uncommitted changes. Commit them (or `git commit --fixup`) first.')
  if (!tryGit(paths.workTree, [
    'merge-base',
    '--is-ancestor',
    pinned,
    'HEAD',
  ])) {
    throw new Error(`The work branch is not based on the pinned release ${pinned.slice(0, 12)}. Run \`pnpm paseo:edit\` to rebase it.`)
  }
  for (const patch of listPatches(paths.patches))
    rmSync(patch)
  mkdirSync(paths.patches, { recursive: true })
  if (workCommits(paths, pinned).length === 0)
    return []
  const written = git(paths.workTree, [
    'format-patch',
    ...FORMAT_PATCH_FLAGS,
    '-o',
    paths.patches,
    `${pinned}..HEAD`,
  ])
  return written.split('\n').filter(Boolean)
}

/** The newest stable upstream release tag, e.g. v0.15.0 but never v0.15.0-beta.1. */
export function latestReleaseTag(submodule: string): string {
  git(submodule, ['fetch', '--quiet', '--tags', 'origin'])
  const tags = git(submodule, [
    'tag',
    '--list',
    'v*',
    '--sort=-v:refname',
  ]).split('\n')
  const stable = tags.find(tag => /^v\d+\.\d+\.\d+$/.test(tag))
  if (!stable)
    throw new Error('No stable release tag found upstream')
  return stable
}
