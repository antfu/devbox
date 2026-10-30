// Adds the agent profiles below to Paseo's config.json when it does not have them yet.
//
// Paseo has no setting for a default permission mode: each provider's default is fixed (Claude `auto`,
// Codex `auto-review`), and the app only remembers the last mode picked, per device. A saved agent profile
// is the closest thing: one click in the new-agent picker applies its provider and mode. The cage is the
// isolation here, so the profiles skip the permission prompts.
//
// Runs before the daemon starts, only edits a config.json that already exists (a fresh file without
// Paseo's own defaults could change its behaviour, e.g. relay), and never replaces a profile with the
// same id, so edits made in the settings page stay. Any problem is logged and skipped.
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

const PROFILES = [
  {
    id: 'claude-bypass',
    name: 'Claude (bypass)',
    provider: 'claude',
    modeId: 'bypassPermissions',
    notes: 'Skips every permission prompt. Safe here because the container is the isolation.',
  },
  {
    id: 'codex-full-access',
    name: 'Codex (full access)',
    provider: 'codex',
    modeId: 'full-access',
    notes: 'Edits files, runs commands and uses the network without prompts. Safe here because the container is the isolation.',
  },
]

/** The entrypoint's log lines go to the container logs. */
function log(message) {
  process.stdout.write(`${message}\n`)
}

const home = process.env.PASEO_HOME || join(process.env.HOME || '/home/paseo', '.paseo')
const file = join(home, 'config.json')

try {
  if (!existsSync(file)) {
    log(`seed-profiles: no ${file} yet, start paseo once and restart to add the profiles`)
    process.exit(0)
  }
  const config = JSON.parse(readFileSync(file, 'utf8'))
  const daemon = config.daemon ??= {}
  const profiles = daemon.agentProfiles ??= []
  const added = PROFILES.filter(profile => !profiles.some(existing => existing.id === profile.id))
  if (added.length === 0) {
    log('seed-profiles: profiles already present')
    process.exit(0)
  }
  profiles.push(...added)
  const next = `${file}.seed`
  writeFileSync(next, `${JSON.stringify(config, null, 2)}\n`)
  renameSync(next, file)
  log(`seed-profiles: added ${added.map(profile => profile.id).join(', ')}`)
}
catch (error) {
  console.error(`seed-profiles: skipped, ${error instanceof Error
    ? error.message
    : error}`)
}
