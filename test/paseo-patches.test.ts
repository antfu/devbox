import type { PaseoPatchPaths } from '../src/paseo-patches'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { exportPatches, isWorkTreeExported, latestReleaseTag, listPatches, prepareBuildTree, startEditing } from '../src/paseo-patches'

const dirs: string[] = []

beforeAll(() => {
  // Keep the host's git config (signing, hooks, identity) out of the throwaway repos.
  Object.assign(process.env, {
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_AUTHOR_NAME: 'Test',
    GIT_AUTHOR_EMAIL: 'test@example.com',
    GIT_COMMITTER_NAME: 'Test',
    GIT_COMMITTER_EMAIL: 'test@example.com',
  })
})

afterEach(() => {
  for (const dir of dirs.splice(0))
    rmSync(dir, { recursive: true, force: true })
})

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

function commit(repo: string, files: Record<string, string>, message: string): void {
  for (const [name, content] of Object.entries(files))
    writeFileSync(join(repo, name), content)
  git(repo, 'add', '-A')
  git(repo, 'commit', '-q', '-m', message)
}

/** An "upstream" with releases, a submodule-like clone pinned at v1.0.0, and an empty patch folder. */
function setup(): PaseoPatchPaths & { upstream: string } {
  const root = mkdtempSync(join(tmpdir(), 'paseo-patches-'))
  dirs.push(root)
  const upstream = join(root, 'upstream')
  mkdirSync(upstream)
  git(upstream, 'init', '-q', '-b', 'main')
  commit(upstream, { 'a.txt': 'one\ntwo\nthree\n', 'b.txt': 'b\n' }, 'release 1.0.0')
  git(upstream, 'tag', 'v1.0.0')
  const submodule = join(root, 'submodule')
  git(root, 'clone', '-q', upstream, submodule)
  git(submodule, 'checkout', '-q', '--detach', 'v1.0.0')
  return {
    upstream,
    submodule,
    patches: join(root, 'patches'),
    buildTree: join(root, 'cache/build'),
    workTree: join(root, 'cache/work'),
  }
}

/** Write a series of changes as patches, through the same edit and export the tool uses. */
function writeSeries(paths: PaseoPatchPaths, changes: Array<[Record<string, string>, string]>): void {
  startEditing(paths)
  for (const [files, message] of changes)
    commit(paths.workTree, files, message)
  exportPatches(paths)
}

describe('paseo patches', () => {
  it('builds the pinned release with every patch applied, and leaves the submodule alone', () => {
    const paths = setup()
    writeSeries(paths, [
      [
        { 'a.txt': 'one\nTWO\nthree\n' },
        'feat: shout two',
      ],
      [
        { 'c.txt': 'new\n' },
        'feat: add c',
      ],
    ])

    expect(prepareBuildTree(paths)).toHaveLength(2)
    expect(readFileSync(join(paths.buildTree, 'a.txt'), 'utf8')).toBe('one\nTWO\nthree\n')
    expect(readFileSync(join(paths.buildTree, 'c.txt'), 'utf8')).toBe('new\n')
    expect(readFileSync(join(paths.submodule, 'a.txt'), 'utf8')).toBe('one\ntwo\nthree\n')
    expect(git(paths.submodule, 'status', '--porcelain')).toBe('')

    // A second build starts from a clean release again, dropping leftovers.
    writeFileSync(join(paths.buildTree, 'stray.txt'), '')
    prepareBuildTree(paths)
    expect(existsSync(join(paths.buildTree, 'stray.txt'))).toBe(false)
  })

  it('exports one stable file per commit, so a round trip changes nothing', () => {
    const paths = setup()
    writeSeries(paths, [
      [
        { 'a.txt': 'one\nTWO\nthree\n' },
        'feat: shout two\n\nFork-Change: F-1',
      ],
    ])
    const [patch] = listPatches(paths.patches)
    const before = readFileSync(patch!, 'utf8')
    expect(before).toMatch(/^From 0{40} /)
    expect(before).toContain('Subject: [PATCH] feat: shout two')
    expect(before).toContain('Fork-Change: F-1')

    expect(startEditing(paths)).toEqual({ kind: 'ready', commits: 1 })
    exportPatches(paths)
    expect(readdirSync(paths.patches)).toEqual([
      patch!.split('/').pop(),
    ])
    expect(readFileSync(patch!, 'utf8')).toBe(before)
  })

  it('refuses to recreate the work tree over work that is not exported', () => {
    const paths = setup()
    writeSeries(paths, [
      [
        { 'a.txt': 'one\nTWO\nthree\n' },
        'feat: shout two',
      ],
    ])
    startEditing(paths)
    expect(isWorkTreeExported(paths)).toBe(true)

    commit(paths.workTree, { 'b.txt': 'B\n' }, 'feat: shout b')
    expect(isWorkTreeExported(paths)).toBe(false)
    expect(() => startEditing(paths)).toThrow(/not exported/)

    writeFileSync(join(paths.workTree, 'a.txt'), 'dirty\n')
    expect(() => exportPatches(paths)).toThrow(/uncommitted/)
    expect(startEditing(paths, true)).toEqual({ kind: 'ready', commits: 1 })
  })

  it('rebases the series onto a new release, and reports a conflict instead of building it', () => {
    const paths = setup()
    writeSeries(paths, [
      [
        { 'a.txt': 'one\nTWO\nthree\n' },
        'feat: shout two',
      ],
    ])

    // Upstream touches another file: the patch still applies.
    commit(paths.upstream, { 'b.txt': 'b2\n' }, 'release 1.1.0')
    git(paths.upstream, 'tag', 'v1.1.0')
    // Upstream rewrites the patched line: the patch conflicts.
    commit(paths.upstream, { 'a.txt': 'one\nzwei\nthree\n' }, 'release 2.0.0')
    git(paths.upstream, 'tag', 'v2.0.0')
    git(paths.upstream, 'tag', 'v2.1.0-beta.1')

    expect(latestReleaseTag(paths.submodule)).toBe('v2.0.0')

    git(paths.submodule, 'checkout', '-q', '--detach', 'v1.1.0')
    expect(prepareBuildTree(paths)).toHaveLength(1)
    expect(startEditing(paths)).toEqual({ kind: 'ready', commits: 1 })
    exportPatches(paths)

    git(paths.submodule, 'checkout', '-q', '--detach', 'v2.0.0')
    expect(() => prepareBuildTree(paths)).toThrow(/does not apply/)
    expect(startEditing(paths)).toEqual({ kind: 'conflict' })
    expect(() => exportPatches(paths)).toThrow(/git am/)
  })
})
