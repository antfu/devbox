import type { SubmoduleName } from './vendor'
import { capture, run } from './shell'
import { buildDevContainer, initSubmodules, SUBMODULES } from './vendor'

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
