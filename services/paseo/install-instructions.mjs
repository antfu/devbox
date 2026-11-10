// Puts agent-instructions.md into the global instructions of every agent in the container: Claude Code's
// CLAUDE.md, and the AGENTS.md that Codex, OpenCode and Pi read.
//
// The text goes between two marker lines, which are replaced on every start, so edits to
// agent-instructions.md arrive with a restart and anything else in the file stays. Any problem is
// logged and skipped, so a read-only or half-prepared home never blocks the container.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import process from 'node:process'

const source = process.argv[2] || '/etc/paseo-agent-instructions.md'
const home = process.env.HOME || '/home/paseo'
const targets = [
  join(process.env.CLAUDE_CONFIG_DIR || join(home, '.claude'), 'CLAUDE.md'),
  join(process.env.CODEX_HOME || join(home, '.codex'), 'AGENTS.md'),
  join(home, '.config/opencode/AGENTS.md'),
  join(home, '.pi/agent/AGENTS.md'),
]

const START = '<!-- devbox:instructions:start (managed: replaced on every start) -->'
const END = '<!-- devbox:instructions:end -->'

function log(message) {
  process.stdout.write(`install-instructions: ${message}\n`)
}

/** The file's text with the managed block replaced by `block`, or appended when it has none. */
function withBlock(current, block) {
  const start = current.indexOf(START)
  const end = current.indexOf(END, start)
  if (start !== -1 && end !== -1)
    return current.slice(0, start) + block + current.slice(end + END.length)
  return current.trim()
    ? `${current.trimEnd()}\n\n${block}\n`
    : `${block}\n`
}

let text
try {
  text = readFileSync(source, 'utf8').trim()
}
catch (error) {
  log(`skipped, cannot read ${source}: ${error instanceof Error
    ? error.message
    : error}`)
  process.exit(0)
}
const block = `${START}\n${text}\n${END}`
for (const file of targets) {
  try {
    const current = existsSync(file)
      ? readFileSync(file, 'utf8')
      : ''
    const next = withBlock(current, block)
    if (next === current)
      continue
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(`${file}.seed`, next)
    renameSync(`${file}.seed`, file)
    log(`updated ${file}`)
  }
  catch (error) {
    process.stderr.write(`install-instructions: skipped ${file}, ${error instanceof Error
      ? error.message
      : error}\n`)
  }
}
