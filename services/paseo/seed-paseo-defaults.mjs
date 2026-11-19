// Seeds our defaults into paseo's config.json and the agents' homes, before the daemon starts:
//
// - Host settings that upstream ships off: Archive merged PR workspaces, Resume agents after restart, Enable
//   Paseo tools and Browser tools.
// - Orchestration skills: the daemon's bundled skills, copied into ~/.agents/skills and ~/.claude/skills as
//   the settings switch would. The daemon keeps them in step with its version from then on.
// - With --providers, fx (fx.sh) as an ACP agent provider: paseo runs `fx acp` and talks to it over stdio.
//   `fx` is dev-base's wrapper, which relays fx's AI Gateway traffic through the broker. New fx agents start
//   in Full access, like Claude and Codex here, since the container is the isolation.
//
// Defaults, not locks: a setting or provider is only written when config.json has no value for it, so a change
// made in the web UI or by hand wins, and the skills are only copied once per home. Any problem is logged and
// skipped.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import process from 'node:process'

const home = process.env.HOME || '/home/paseo'
const paseoHome = process.env.PASEO_HOME || join(home, '.paseo')
const file = join(paseoHome, 'config.json')

/** Paths into config.json, with the value each gets when it is unset. */
const SETTINGS = {
  'daemon.autoArchiveAfterMerge': true,
  'agents.resumeOnStartup': true,
  'daemon.mcp.injectIntoAgents': true,
  'daemon.browserTools.enabled': true,
}

const PROVIDERS = {
  fx: {
    extends: 'acp',
    label: 'fx',
    description: 'Vercel Labs\' coding agent, on the AI Gateway',
    command: ['fx', 'acp'],
    defaultModeId: 'full-access',
  },
}

const SKILLS_TARGETS = [
  join(home, '.agents', 'skills'),
  join(home, '.claude', 'skills'),
  join(home, '.codex', 'skills'),
]
// Set once the skills were copied, so turning the switch off in the web UI sticks across restarts.
const SKILLS_MARKER = join(paseoHome, '.devbox-skills-seeded')

/** The entrypoint's log lines go to the container logs. */
function log(message) {
  process.stdout.write(`seed-paseo-defaults: ${message}\n`)
}

function logSkipped(what, error) {
  process.stderr.write(`seed-paseo-defaults: skipped ${what}, ${error instanceof Error
    ? error.message
    : error}\n`)
}

function seedConfig() {
  const config = existsSync(file)
    ? JSON.parse(readFileSync(file, 'utf8'))
    : { version: 1 }
  const added = []
  for (const [path, value] of Object.entries(SETTINGS)) {
    const keys = path.split('.')
    const key = keys.pop()
    let parent = config
    for (const part of keys)
      parent = parent[part] ??= {}
    if (parent[key] === undefined) {
      parent[key] = value
      added.push(path)
    }
  }
  if (process.argv.includes('--providers')) {
    config.agents ??= {}
    config.agents.providers ??= {}
    for (const id of Object.keys(PROVIDERS)) {
      if (!(id in config.agents.providers)) {
        config.agents.providers[id] = PROVIDERS[id]
        added.push(`agents.providers.${id}`)
      }
    }
  }
  if (added.length === 0) {
    log('config already set')
    return
  }
  mkdirSync(dirname(file), { recursive: true })
  const next = `${file}.seed`
  writeFileSync(next, `${JSON.stringify(config, null, 2)}\n`)
  renameSync(next, file)
  log(`set ${added.join(', ')}`)
}

function seedSkills() {
  if (existsSync(SKILLS_MARKER)) {
    log('orchestration skills already seeded')
    return
  }
  // Upstream's image records the server's entry script there; the skills ship in the same dist folder.
  const source = join(dirname(dirname(readFileSync('/etc/paseo-server-entry', 'utf8').trim())), 'server', 'skills')
  const names = readdirSync(source, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => entry.name)
  // Any one of them on disk reads as installed to the daemon, which then adds the rest itself.
  const installed = names.some(name => SKILLS_TARGETS.some(dir => existsSync(join(dir, name))))
  if (!installed) {
    for (const dir of SKILLS_TARGETS.slice(0, 2)) {
      for (const name of names)
        cpSync(join(source, name), join(dir, name), { recursive: true })
    }
    log(`installed orchestration skills ${names.join(', ')}`)
  }
  mkdirSync(paseoHome, { recursive: true })
  writeFileSync(SKILLS_MARKER, '')
}

try {
  seedConfig()
}
catch (error) {
  logSkipped('config', error)
}

try {
  seedSkills()
}
catch (error) {
  logSkipped('orchestration skills', error)
}
