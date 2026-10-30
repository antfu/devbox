// Turns off the "Co-Authored-By: Claude" commit trailer and the "Generated with Claude Code" pull request
// line by default, by adding an empty `attribution` to Claude Code's user settings.
//
// A default, not a lock: it only adds the key when the file does not set it, so a change made later, in
// this file or in a project's own settings, wins. Runs on every start, and any problem is logged and
// skipped, so a read-only or half-prepared home never blocks the container.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import process from 'node:process'

const dir = process.env.CLAUDE_CONFIG_DIR || join(process.env.HOME || '/home/paseo', '.claude')
const file = join(dir, 'settings.json')

/** The entrypoint's log lines go to the container logs. */
function log(message) {
  process.stdout.write(`${message}\n`)
}

try {
  const settings = existsSync(file)
    ? JSON.parse(readFileSync(file, 'utf8'))
    : {}
  if ('attribution' in settings || 'includeCoAuthoredBy' in settings) {
    log('seed-claude-settings: attribution already set')
    process.exit(0)
  }
  settings.attribution = { commit: '', pr: '' }
  mkdirSync(dirname(file), { recursive: true })
  const next = `${file}.seed`
  writeFileSync(next, `${JSON.stringify(settings, null, 2)}\n`)
  renameSync(next, file)
  log('seed-claude-settings: turned off the Claude co-author trailer and PR line')
}
catch (error) {
  process.stderr.write(`seed-claude-settings: skipped, ${error instanceof Error
    ? error.message
    : error}\n`)
}
