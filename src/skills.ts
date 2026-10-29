import { execFileSync } from 'node:child_process'
import { mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { ROOT } from './shell'

const LIST = join(ROOT, 'services/paseo/skills.txt')
const SKILLS_DIR = join(ROOT, 'skills')
const AGENTS = [
  'claude-code',
  'codex',
  'opencode',
  'pi',
]

/**
 * Install the skills in services/paseo/skills.txt into ./skills, which paseo mounts. The `skills` CLI
 * installs into $HOME, so each run points HOME at ./skills and starts from an empty folder, which drops
 * skills whose source was removed from the list. One failed source does not stop the others.
 */
export function syncSkills(): void {
  const sources = readFileSync(LIST, 'utf8')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))

  // Empty the folder, not replace it: paseo has it bind-mounted, and a new folder would not show up there.
  mkdirSync(SKILLS_DIR, { recursive: true })
  for (const entry of readdirSync(SKILLS_DIR))
    rmSync(join(SKILLS_DIR, entry), { recursive: true, force: true })

  const failed: string[] = []
  for (const line of sources) {
    const [source = '', ...names] = line.split(/\s+/)
    console.log(`skills: ${source} ${names.join(' ') || '(all skills)'}`)
    try {
      execFileSync(
        join(ROOT, 'node_modules/.bin/skills'),
        [
          'add',
          source,
          '--global',
          '--yes',
          '--agent',
          ...AGENTS,
          '--skill',
          ...names.length > 0
            ? names
            : ['*'],
        ],
        // The CLI reports installs to its own service, which is no use here.
        {
          stdio: ['ignore', 'inherit', 'inherit'],
          env: { ...process.env, HOME: SKILLS_DIR, DISABLE_TELEMETRY: '1' },
        },
      )
    }
    catch {
      failed.push(source)
    }
  }

  const count = readdirSync(join(SKILLS_DIR, '.agents/skills'), { withFileTypes: true }).filter(entry => entry.isDirectory()).length
  console.log(`skills: ${count} skills in ./skills`)
  if (failed.length > 0) {
    console.error(`skills: could not install ${failed.join(', ')}`)
    process.exit(1)
  }
}
