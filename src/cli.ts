import process from 'node:process'
import { installAgent, uninstallAgent } from './launchd'
import { sync } from './sync'
import { upgrade } from './upgrade'
import { buildDevContainer, initSubmodules, isSubmoduleName } from './vendor'

const [command, subcommand, ...rest] = process.argv.slice(2)

switch (`${command} ${subcommand ?? ''}`.trim()) {
  case 'sync':
    sync({
      force: process.argv.includes('--force'),
    })
    break
  case 'launchd install':
    installAgent()
    break
  case 'launchd uninstall':
    uninstallAgent()
    break
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
  default:
    console.error('usage: cli.ts sync [--force] | launchd install|uninstall | vendor setup|upgrade [dev-container|vi]')
    process.exit(1)
}
