import { join } from 'node:path'
import { ROOT, run } from './shell'

export const SUBMODULES = {
  'dev-container': 'vendor/dev-container',
  'vi': 'vendor/vi',
} as const

export type SubmoduleName = keyof typeof SUBMODULES

export function isSubmoduleName(name: string): name is SubmoduleName {
  return name in SUBMODULES
}

/** Init every submodule at the commit this repo pins. */
export function initSubmodules(): void {
  run('git', [
    'submodule',
    'update',
    '--init',
    '--recursive',
  ])
}

/** dev-container ships its CLI as built output, so it needs its own install and build. */
export function buildDevContainer(): void {
  const cwd = join(ROOT, SUBMODULES['dev-container'])
  run('pnpm', ['install', '--frozen-lockfile', '--ignore-scripts'], cwd)
  run('pnpm', ['build'], cwd)
}
