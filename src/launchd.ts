import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { ROOT, run } from './shell'

const LABEL = 'dev.antfu.containers.sync'

const plistPath = join(homedir(), 'Library', 'LaunchAgents', `${LABEL}.plist`)
const domain = `gui/${process.getuid?.() ?? 501}`

/** A launchd agent that runs `pnpm sync` every `intervalSeconds`, through a login shell for PATH. */
export function renderPlist({ root, intervalSeconds }: { root: string, intervalSeconds: number }): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string>
    <string>-lc</string>
    <string>cd '${root}' &amp;&amp; pnpm sync</string>
  </array>
  <key>StartInterval</key>
  <integer>${intervalSeconds}</integer>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${root}/.sync/sync.log</string>
  <key>StandardErrorPath</key>
  <string>${root}/.sync/sync.log</string>
</dict>
</plist>
`
}

export function installAgent(intervalSeconds = 300): void {
  mkdirSync(join(ROOT, '.sync'), { recursive: true })
  unload()
  writeFileSync(plistPath, renderPlist({ root: ROOT, intervalSeconds }))
  run('launchctl', ['bootstrap', domain, plistPath])
  console.log(`installed ${plistPath}, syncing every ${intervalSeconds}s`)
}

export function uninstallAgent(): void {
  unload()
  rmSync(plistPath, { force: true })
}

function unload(): void {
  try {
    run('launchctl', ['bootout', `${domain}/${LABEL}`])
  }
  catch {
    // Not loaded yet, which is fine on a first install.
  }
}
