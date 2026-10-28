import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { capture, ROOT, run } from './shell'
import { buildDevContainer, initSubmodules, SUBMODULES } from './vendor'

export interface Revisions {
  /** This repo's HEAD, which covers config, Dockerfiles and every submodule pointer. */
  head: string
  /** The pinned dev-container commit, which decides whether its CLI needs a rebuild. */
  devContainer: string
}

export interface SyncPlan {
  deploy: boolean
  rebuildDevContainer: boolean
}

const STATE_DIR = join(ROOT, '.sync')
const STATE_FILE = join(STATE_DIR, 'deployed.json')

/** Decide what a sync run has to do, given what was last deployed successfully. */
export function planSync({ deployed, current, force = false }: { deployed?: Revisions, current: Revisions, force?: boolean }): SyncPlan {
  return {
    deploy: force || deployed?.head !== current.head,
    rebuildDevContainer: deployed?.devContainer !== current.devContainer,
  }
}

function currentRevisions(): Revisions {
  return {
    head: capture('git', ['rev-parse', 'HEAD']),
    devContainer: capture('git', ['rev-parse', `HEAD:${SUBMODULES['dev-container']}`]),
  }
}

function readDeployed(): Revisions | undefined {
  if (!existsSync(STATE_FILE))
    return undefined
  return JSON.parse(readFileSync(STATE_FILE, 'utf8')) as Revisions
}

function writeDeployed(revisions: Revisions): void {
  mkdirSync(STATE_DIR, { recursive: true })
  writeFileSync(STATE_FILE, `${JSON.stringify(revisions, null, 2)}\n`)
}

/**
 * Fast-forward this repo, then redeploy only when HEAD moved since the last good deploy.
 * A failure throws before the state file is written, so the next run retries and the
 * previous containers keep running.
 */
export function sync({ force = false }: { force?: boolean } = {}): void {
  run('git', ['pull', '--ff-only'])
  initSubmodules()

  const current = currentRevisions()
  const plan = planSync({
    deployed: readDeployed(),
    current,
    force,
  })
  if (!plan.deploy) {
    console.log(`up to date at ${current.head.slice(0, 7)}`)
    return
  }

  run('pnpm', ['install', '--frozen-lockfile', '--ignore-scripts'])
  if (plan.rebuildDevContainer)
    buildDevContainer()
  run('pnpm', ['build'])
  run('pnpm', ['dc', 'up'])
  writeDeployed(current)
  console.log(`deployed ${current.head.slice(0, 7)}`)
}
