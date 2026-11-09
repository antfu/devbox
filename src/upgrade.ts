import type { SubmoduleName } from './vendor'
import { latestReleaseTag } from './paseo-patches'
import { capture, run } from './shell'
import { buildDevContainer, initSubmodules, PASEO_PATCH_PATHS, SUBMODULES } from './vendor'

/**
 * Move submodules to their remote's latest commit, rebuild dev-container if it moved,
 * and leave the new pointers staged for you to review and commit.
 */
export function upgrade(names: SubmoduleName[] = Object.keys(SUBMODULES) as SubmoduleName[]): void {
  initSubmodules()
  const before = Object.fromEntries(names.map(name => [
    name,
    pointer(name),
  ]))

  for (const name of names) {
    if (name === 'paseo') {
      // Upstream releases, not main: the daemon we run should match a version the apps know.
      const submodule = PASEO_PATCH_PATHS.submodule
      run('git', [
        'checkout',
        '--quiet',
        '--detach',
        latestReleaseTag(submodule),
      ], submodule)
      continue
    }
    run('git', [
      'submodule',
      'update',
      '--remote',
      '--merge',
      SUBMODULES[name],
    ])
  }

  if (names.includes('dev-container') && pointer('dev-container') !== before['dev-container'])
    buildDevContainer()

  for (const name of names) {
    const after = pointer(name)
    console.log(after === before[name]
      ? `${name}: already latest`
      : `${name}: ${before[name]?.slice(0, 7)} -> ${after.slice(0, 7)}`)
  }
  if (names.includes('paseo') && pointer('paseo') !== before.paseo)
    console.log(`paseo moved: run \`pnpm paseo:edit\` to rebase the patches in ${PASEO_PATCH_PATHS.workTree}, then \`pnpm paseo:export\`.`)
  console.log('Review with `git diff --submodule`, then commit the updated pointers.')
}

/** The commit the submodule currently has checked out. */
function pointer(name: SubmoduleName): string {
  return capture('git', [
    '-C',
    SUBMODULES[name],
    'rev-parse',
    'HEAD',
  ])
}
