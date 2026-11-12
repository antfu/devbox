import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { capture, ROOT } from './shell'

/** The dev-base Dockerfile, whose `ARG <NAME>_PACKAGES="..."` lines list each agent CLI stage's npm packages. */
export const DEV_BASE_DOCKERFILE = join(ROOT, 'services/dev-base/Dockerfile')

/** The `*_PACKAGES` build args of a Dockerfile and the packages each one lists. */
export function parsePackageArgs(dockerfile: string): Map<string, string[]> {
  const args = new Map<string, string[]>()
  for (const match of dockerfile.matchAll(/^ARG ([A-Z0-9_]+_PACKAGES)="([^"]*)"$/gm))
    args.set(match[1], match[2].split(/\s+/).filter(Boolean))
  return args
}

/**
 * `NAME=pkg@version ...` lines for `docker build --build-arg`, one per stage. A stage's layer then changes only
 * when one of its packages has a new release, so CI keeps the others cached.
 */
export function pinnedPackageArgs(args: Map<string, string[]>, versionOf: (name: string) => string): string[] {
  return [...args].map(([arg, packages]) =>
    `${arg}=${packages.map(name => `${name}@${versionOf(name)}`).join(' ')}`)
}

export function resolveAgentCliArgs(): string[] {
  const args = parsePackageArgs(readFileSync(DEV_BASE_DOCKERFILE, 'utf8'))
  return pinnedPackageArgs(args, name => capture('npm', ['view', name, 'version']))
}
