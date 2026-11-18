// Adds fx (fx.sh) to paseo's agent providers, as an ACP agent: paseo runs `fx acp` and talks to it over
// stdio. `fx` is dev-base's wrapper, which relays fx's AI Gateway traffic through the broker. New fx agents
// start in Full access, like Claude and Codex here, since the container is the isolation.
//
// A default, not a lock: it only adds the provider when config.json has no `fx` entry, so a change made in the
// web UI or by hand wins. Runs before the daemon starts, and any problem is logged and skipped.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import process from 'node:process'

const file = join(process.env.PASEO_HOME || join(process.env.HOME || '/home/paseo', '.paseo'), 'config.json')

const PROVIDERS = {
  fx: {
    extends: 'acp',
    label: 'fx',
    description: 'Vercel Labs\' coding agent, on the AI Gateway',
    command: ['fx', 'acp'],
    defaultModeId: 'full-access',
  },
}

/** The entrypoint's log lines go to the container logs. */
function log(message) {
  process.stdout.write(`${message}\n`)
}

try {
  const config = existsSync(file)
    ? JSON.parse(readFileSync(file, 'utf8'))
    : { version: 1 }
  config.agents ??= {}
  config.agents.providers ??= {}
  const added = Object.keys(PROVIDERS).filter(id => !(id in config.agents.providers))
  if (added.length === 0) {
    log('seed-paseo-providers: providers already set')
    process.exit(0)
  }
  for (const id of added)
    config.agents.providers[id] = PROVIDERS[id]
  mkdirSync(dirname(file), { recursive: true })
  const next = `${file}.seed`
  writeFileSync(next, `${JSON.stringify(config, null, 2)}\n`)
  renameSync(next, file)
  log(`seed-paseo-providers: added ${added.join(', ')}`)
}
catch (error) {
  process.stderr.write(`seed-paseo-providers: skipped, ${error instanceof Error
    ? error.message
    : error}\n`)
}
