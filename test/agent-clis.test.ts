import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DEV_BASE_DOCKERFILE, parsePackageArgs, pinnedPackageArgs } from '../src/agent-clis'

describe('parsePackageArgs', () => {
  it('reads every *_PACKAGES arg and its packages', () => {
    const dockerfile = [
      'FROM agent-cli AS codex',
      'ARG CODEX_PACKAGES="@openai/codex"',
      'ARG OTHER=1',
      'ARG TOOLS_PACKAGES="agent-browser  @antfu/ni"',
    ].join('\n')
    expect(parsePackageArgs(dockerfile)).toEqual(new Map([
      [
        'CODEX_PACKAGES',
        ['@openai/codex'],
      ],
      [
        'TOOLS_PACKAGES',
        ['agent-browser', '@antfu/ni'],
      ],
    ]))
  })

  it('finds a stage for each CLI in the dev-base Dockerfile', () => {
    const args = parsePackageArgs(readFileSync(DEV_BASE_DOCKERFILE, 'utf8'))
    expect([
      ...args.values(),
    ].flat()).toContain('@anthropic-ai/claude-code')
    expect(args.size).toBeGreaterThan(1)
  })
})

describe('pinnedPackageArgs', () => {
  it('pins each package to the version it resolves to', () => {
    const args = new Map([
      [
        'TOOLS_PACKAGES',
        ['taze', '@antfu/ni'],
      ],
    ])
    expect(pinnedPackageArgs(args, name => (name === 'taze'
      ? '1.0.0'
      : '2.0.0')))
      .toEqual(['TOOLS_PACKAGES=taze@1.0.0 @antfu/ni@2.0.0'])
  })
})
