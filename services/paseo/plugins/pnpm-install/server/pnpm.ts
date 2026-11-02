import type { Buffer } from 'node:buffer'
import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/** Why a worktree gets no install, or null when it should get one. */
export function skipReason(worktreePath: string): string | null {
  if (hasSetup(join(worktreePath, 'paseo.json')))
    return 'its paseo.json sets worktree.setup, which does the install'
  const packageJson = join(worktreePath, 'package.json')
  if (!existsSync(packageJson))
    return 'no package.json'
  if (existsSync(join(worktreePath, 'pnpm-lock.yaml')) || usesPnpm(packageJson))
    return null
  return 'not a pnpm project'
}

/** Whether the repo already defines its own worktree setup. */
function hasSetup(paseoJson: string): boolean {
  try {
    const { worktree } = JSON.parse(readFileSync(paseoJson, 'utf8')) as { worktree?: { setup?: unknown } }
    const setup = worktree?.setup
    return Array.isArray(setup)
      ? setup.length > 0
      : typeof setup === 'string' && setup.trim() !== ''
  }
  catch {
    return false
  }
}

/** Whether package.json pins pnpm as its package manager. */
function usesPnpm(packageJson: string): boolean {
  try {
    const { packageManager } = JSON.parse(readFileSync(packageJson, 'utf8')) as { packageManager?: unknown }
    return typeof packageManager === 'string' && packageManager.startsWith('pnpm@')
  }
  catch {
    return false
  }
}

/** Run the install in the worktree, sending each output line to `log`. Resolves with the exit code, or null if it could not start. */
export function install(worktreePath: string, log: (line: string) => void, command: string[] = ['pnpm', 'install']): Promise<number | null> {
  return new Promise((resolve) => {
    const [program = 'pnpm', ...args] = command
    const child = spawn(program, args, {
      cwd: worktreePath,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    for (const stream of [child.stdout, child.stderr]) {
      let pending = ''
      stream.on('data', (chunk: Buffer) => {
        const lines = (pending + chunk.toString()).split('\n')
        pending = lines.pop() ?? ''
        lines.filter(line => line.trim() !== '').forEach(log)
      })
      stream.on('end', () => {
        if (pending.trim() !== '')
          log(pending)
      })
    }
    child.on('error', (error) => {
      log(`could not start ${program}: ${error.message}`)
      resolve(null)
    })
    child.on('close', code => resolve(code))
  })
}
