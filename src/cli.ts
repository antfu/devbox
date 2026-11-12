import { existsSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { resolveAgentCliArgs } from './agent-clis'
import { buildImages } from './build'
import { IDENTITIES, isIdentityId, setupGpgKey } from './keys'
import { exportPatches, prepareBuildTree, startEditing } from './paseo-patches'
import { ROOT } from './shell'
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
  case 'build':
    try {
      process.loadEnvFile('.env')
    }
    catch {
      // .env is optional.
    }
    buildImages(Boolean(process.env.IMAGE_REGISTRY))
    break
  case 'images agent-cli-args':
    // One build arg per line, the shape docker/build-push-action's `build-args` takes.
    console.log(resolveAgentCliArgs().join('\n'))
    break
  case 'keys setup': {
    const ids = rest.filter(arg => !arg.startsWith('--'))
    const unknown = ids.filter(id => !isIdentityId(id))
    if (unknown.length > 0) {
      console.error(`unknown identity: ${unknown.join(', ')} (use ${Object.keys(IDENTITIES).join(' or ')})`)
      process.exit(1)
    }
    const force = rest.includes('--force')
    // Without a name, make the keys that are missing; an explicit name or --force replaces or fails.
    const targets = ids.length > 0
      ? ids.filter(isIdentityId)
      : Object.keys(IDENTITIES).filter(isIdentityId).filter(id => force || !existsSync(join(ROOT, 'keys/gpg', id, 'private.asc')))
    for (const id of targets)
      setupGpgKey(id, force)
    break
  }
  default:
    console.error('usage: cli.ts build | images agent-cli-args | vendor setup|upgrade [dev-container|paseo] | paseo prepare|edit [--force]|export | keys setup [bot|main] [--force]')
    process.exit(1)
}
