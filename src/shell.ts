import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

export const ROOT = fileURLToPath(new URL('..', import.meta.url))

/** Run a command, streaming its output. Throws on a non-zero exit. */
export function run(command: string, args: string[], cwd = ROOT): void {
  execFileSync(command, args, { cwd, stdio: 'inherit' })
}

/** Run a command and return its trimmed stdout. */
export function capture(command: string, args: string[], cwd = ROOT): string {
  return execFileSync(command, args, { cwd, encoding: 'utf8' }).trim()
}
