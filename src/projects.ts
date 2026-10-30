import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

/** What Paseo runs once after it creates a worktree, from the repo's committed paseo.json. */
const PASEO_CONFIG = {
  worktree: { setup: 'pnpm install' },
}

export type ProjectPlan
  = | { action: 'add' }
    | { action: 'skip', reason: string }

/** Decide what to do for one repo: only pnpm projects without a paseo.json get one. */
export function planProject(dir: string): ProjectPlan {
  if (existsSync(join(dir, 'paseo.json')))
    return { action: 'skip', reason: 'has a paseo.json' }
  if (!existsSync(join(dir, 'package.json')))
    return { action: 'skip', reason: 'no package.json' }
  if (existsSync(join(dir, 'pnpm-lock.yaml')) || usesPnpm(join(dir, 'package.json')))
    return { action: 'add' }
  return { action: 'skip', reason: 'not a pnpm project' }
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

/**
 * Give every pnpm repo directly under `folder` a paseo.json that runs `pnpm install` when Paseo creates a
 * worktree. Repos that already have a paseo.json are left alone, and nothing is committed.
 */
export function setupProjects(folder: string, dryRun = false): void {
  const root = resolve(folder)
  const repos = readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && existsSync(join(root, entry.name, '.git')))
    .map(entry => entry.name)
    .sort()
  if (repos.length === 0)
    throw new Error(`no git repositories directly under ${root}`)

  let added = 0
  for (const name of repos) {
    const plan = planProject(join(root, name))
    if (plan.action === 'skip') {
      console.log(`skip  ${name}: ${plan.reason}`)
      continue
    }
    if (!dryRun)
      writeFileSync(join(root, name, 'paseo.json'), `${JSON.stringify(PASEO_CONFIG, null, 2)}\n`)
    console.log(`${dryRun ? 'would add' : 'added'}  ${name}/paseo.json`)
    added++
  }
  console.log(`${added} of ${repos.length} repos${dryRun ? ' would get' : ' got'} a paseo.json. Review and commit it in each repo; Paseo reads the committed one from the base branch.`)
}
