import type { PluginServerContext } from '@getpaseo/plugin/server'
import { install, skipReason } from './server/pnpm'

/**
 * Runs `pnpm install` in every new git worktree, for all projects, so no repo needs its own paseo.json.
 * Output and the result show up in `paseo plugin logs pnpm-install`.
 */
export default function contribute(server: PluginServerContext) {
  return server.addHook('worktree.create.after', async ({ worktree }) => {
    const reason = skipReason(worktree.path)
    if (reason) {
      console.log(`pnpm-install: skipped ${worktree.branch}, ${reason}`)
      return
    }
    // Not awaited. Paseo aborts the worktree's creation if this hook takes longer than 30 seconds, and an
    // install often does. The cost: the first agent can start before the install is done.
    void run(worktree.path, worktree.branch)
  })
}

async function run(path: string, branch: string): Promise<void> {
  console.log(`pnpm-install: installing in ${path} (${branch})`)
  const code = await install(path, line => console.log(`pnpm-install: ${line}`))
  console.log(code === 0
    ? `pnpm-install: done in ${path}`
    : `pnpm-install: failed in ${path}${code === null
      ? ''
      : ` with exit code ${code}`}`)
}
