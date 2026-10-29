import process from 'node:process'
import { setupGpgKey } from './keys'
import { upgrade } from './upgrade'
import { buildDevContainer, initSubmodules, isSubmoduleName } from './vendor'

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
  case 'keys setup':
    setupGpgKey(rest.includes('--force'))
    break
  default:
    console.error('usage: cli.ts vendor setup|upgrade [dev-container|vi] | keys setup [--force]')
    process.exit(1)
}
