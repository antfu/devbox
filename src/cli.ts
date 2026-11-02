import process from 'node:process'
import { setupGpgKey } from './keys'
import { exportPatches, prepareBuildTree, startEditing } from './paseo-patches'
import { syncSkills } from './skills'
import { upgrade } from './upgrade'
import { buildDevContainer, initSubmodules, isSubmoduleName, PASEO_PATCH_PATHS } from './vendor'

const [command, subcommand, ...rest] = process.argv.slice(2)

switch (`${command} ${subcommand ?? ''}`.trim()) {
  case 'vendor setup':
    initSubmodules()
    buildDevContainer()
    break
  case 'vendor upgrade': {
    const unknown = rest.filter(name => !isSubmoduleName(name))
    if (unknown.length > 0) {
      console.error(`unknown submodule: ${unknown.join(', ')}`)
      process.exit(1)
    }
    upgrade(rest.length > 0
      ? rest.filter(isSubmoduleName)
      : undefined)
    break
  }
  case 'paseo prepare': {
    const series = prepareBuildTree(PASEO_PATCH_PATHS)
    console.log(`paseo: applied ${series.length} patches in ${PASEO_PATCH_PATHS.buildTree}`)
    break
  }
  case 'paseo edit': {
    const result = startEditing(PASEO_PATCH_PATHS, rest.includes('--force'))
    console.log(result.kind === 'ready'
      ? `paseo: ${result.commits} patches are commits on the \`patches\` branch in ${PASEO_PATCH_PATHS.workTree}. Edit, commit, then \`pnpm paseo:export\`.`
      : `paseo: a patch did not apply in ${PASEO_PATCH_PATHS.workTree}. Resolve it, \`git am --continue\`, then \`pnpm paseo:export\`.`)
    if (result.kind === 'conflict')
      process.exit(1)
    break
  }
  case 'paseo export': {
    const written = exportPatches(PASEO_PATCH_PATHS)
    console.log(`paseo: wrote ${written.length} patches to ${PASEO_PATCH_PATHS.patches}`)
    break
  }
  case 'skills sync':
    syncSkills()
    break
  case 'keys setup':
    setupGpgKey(rest.includes('--force'))
    break
  default:
    console.error('usage: cli.ts vendor setup|upgrade [dev-container|vi|paseo] | paseo prepare|edit [--force]|export | keys setup [--force] | skills sync')
    process.exit(1)
}
