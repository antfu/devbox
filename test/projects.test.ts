import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { planProject, setupProjects } from '../src/projects'

const folders: string[] = []

/** A folder of repos: each value is the files to put in that repo. */
function makeFolder(repos: Record<string, Record<string, string>>): string {
  const folder = mkdtempSync(join(tmpdir(), 'projects-'))
  folders.push(folder)
  for (const [name, files] of Object.entries(repos)) {
    mkdirSync(join(folder, name, '.git'), { recursive: true })
    for (const [file, content] of Object.entries(files))
      writeFileSync(join(folder, name, file), content)
  }
  return folder
}

afterEach(() => {
  vi.restoreAllMocks()
  for (const folder of folders.splice(0))
    rmSync(folder, { recursive: true, force: true })
})

describe('planProject', () => {
  it('adds a project with a pnpm lockfile', () => {
    const folder = makeFolder({
      app: { 'package.json': '{}', 'pnpm-lock.yaml': '' },
    })
    expect(planProject(join(folder, 'app'))).toEqual({ action: 'add' })
  })

  it('adds a project that pins pnpm without a lockfile', () => {
    const folder = makeFolder({
      app: { 'package.json': '{"packageManager":"pnpm@12.5.1"}' },
    })
    expect(planProject(join(folder, 'app'))).toEqual({ action: 'add' })
  })

  it('skips other package managers, non-node repos and existing paseo.json', () => {
    const folder = makeFolder({
      npm: { 'package.json': '{"packageManager":"npm@10.0.0"}', 'package-lock.json': '' },
      py: { 'pyproject.toml': '' },
      done: { 'package.json': '{}', 'pnpm-lock.yaml': '', 'paseo.json': '{}' },
    })
    expect(planProject(join(folder, 'npm'))).toEqual({ action: 'skip', reason: 'not a pnpm project' })
    expect(planProject(join(folder, 'py'))).toEqual({ action: 'skip', reason: 'no package.json' })
    expect(planProject(join(folder, 'done'))).toEqual({ action: 'skip', reason: 'has a paseo.json' })
  })
})

describe('setupProjects', () => {
  it('writes paseo.json only into pnpm repos, and leaves existing files alone', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const folder = makeFolder({
      a: { 'package.json': '{}', 'pnpm-lock.yaml': '' },
      b: { 'package.json': '{}', 'package-lock.json': '' },
      c: { 'package.json': '{}', 'pnpm-lock.yaml': '', 'paseo.json': '{"keep":true}' },
    })
    setupProjects(folder)
    expect(JSON.parse(readFileSync(join(folder, 'a/paseo.json'), 'utf8'))).toEqual({
      worktree: { setup: 'pnpm install' },
    })
    expect(() => readFileSync(join(folder, 'b/paseo.json'))).toThrow()
    expect(readFileSync(join(folder, 'c/paseo.json'), 'utf8')).toBe('{"keep":true}')
  })

  it('writes nothing on a dry run', () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const folder = makeFolder({
      a: { 'package.json': '{}', 'pnpm-lock.yaml': '' },
    })
    setupProjects(folder, true)
    expect(() => readFileSync(join(folder, 'a/paseo.json'))).toThrow()
  })

  it('fails when the folder has no repos', () => {
    const folder = makeFolder({})
    expect(() => setupProjects(folder)).toThrow('no git repositories')
  })
})
