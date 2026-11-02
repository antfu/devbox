import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { install, skipReason } from '../services/paseo/plugins/pnpm-install/server/pnpm'

const dirs: string[] = []

/** A worktree folder holding the given files. */
function worktree(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'worktree-'))
  dirs.push(dir)
  for (const [name, content] of Object.entries(files)) {
    mkdirSync(join(dir, name, '..'), { recursive: true })
    writeFileSync(join(dir, name), content)
  }
  return dir
}

afterEach(() => {
  for (const dir of dirs.splice(0))
    rmSync(dir, { recursive: true, force: true })
})

describe('skipReason', () => {
  it('installs in a project with a pnpm lockfile', () => {
    expect(skipReason(worktree({ 'package.json': '{}', 'pnpm-lock.yaml': '' }))).toBeNull()
  })

  it('installs in a project that pins pnpm without a lockfile', () => {
    expect(skipReason(worktree({ 'package.json': '{"packageManager":"pnpm@12.5.1"}' }))).toBeNull()
  })

  it('skips other package managers and non-node repos', () => {
    expect(skipReason(worktree({ 'package.json': '{"packageManager":"npm@10.0.0"}' }))).toBe('not a pnpm project')
    expect(skipReason(worktree({ 'pyproject.toml': '' }))).toBe('no package.json')
  })

  it('leaves the install to a paseo.json that sets worktree.setup', () => {
    const files = { 'package.json': '{}', 'pnpm-lock.yaml': '' }
    expect(skipReason(worktree({ ...files, 'paseo.json': '{"worktree":{"setup":"pnpm i"}}' }))).toContain('worktree.setup')
    expect(skipReason(worktree({ ...files, 'paseo.json': '{"worktree":{"setup":["pnpm i"]}}' }))).toContain('worktree.setup')
  })

  it('still installs when paseo.json has no setup or is not valid JSON', () => {
    const files = { 'package.json': '{}', 'pnpm-lock.yaml': '' }
    expect(skipReason(worktree({ ...files, 'paseo.json': '{"scripts":{}}' }))).toBeNull()
    expect(skipReason(worktree({ ...files, 'paseo.json': '{"worktree":{"setup":""}}' }))).toBeNull()
    expect(skipReason(worktree({ ...files, 'paseo.json': '{oops' }))).toBeNull()
  })
})

describe('install', () => {
  it('runs in the worktree, logs each line and resolves with the exit code', async () => {
    const dir = worktree({})
    const lines: string[] = []
    const code = await install(dir, line => lines.push(line), ['node', '-e', 'console.log("a"); console.error("b"); console.log(process.cwd())'])
    expect(code).toBe(0)
    expect(lines).toContain('a')
    expect(lines).toContain('b')
    expect(lines.some(line => line.endsWith(dir.split('/').pop() ?? ''))).toBe(true)
  })

  it('resolves with a failing exit code', async () => {
    expect(await install(worktree({}), () => {}, ['node', '-e', 'process.exit(3)'])).toBe(3)
  })

  it('resolves with null and logs when the program is missing', async () => {
    const lines: string[] = []
    expect(await install(worktree({}), line => lines.push(line), ['definitely-not-a-program'])).toBeNull()
    expect(lines[0]).toContain('could not start')
  })
})
