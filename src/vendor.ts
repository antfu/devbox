import type { PaseoPatchPaths } from './paseo-patches'
import { join } from 'node:path'
import { ROOT, run } from './shell'

export const SUBMODULES = {
  'dev-container': 'vendor/dev-container',
  'paseo': 'vendor/paseo',
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

/** vendor/paseo and the patch series that turns it into what we build. See AGENTS.md. */
export const PASEO_PATCH_PATHS: PaseoPatchPaths = {
  submodule: join(ROOT, SUBMODULES.paseo),
  patches: join(ROOT, 'services/paseo/patches'),
  buildTree: join(ROOT, '.cache/paseo-build'),
  workTree: join(ROOT, '.cache/paseo-work'),
}
