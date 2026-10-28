import { describe, expect, it } from 'vitest'
import { renderPlist } from '../src/launchd'
import { planSync } from '../src/sync'

const deployed = { head: 'aaa', devContainer: 'd1' }

describe('planSync', () => {
  it('deploys and rebuilds on the first run', () => {
    expect(planSync({ current: deployed })).toEqual({ deploy: true, rebuildDevContainer: true })
  })

  it('does nothing when HEAD has not moved', () => {
    expect(planSync({ deployed, current: deployed })).toEqual({ deploy: false, rebuildDevContainer: false })
  })

  it('deploys without rebuilding when only other files changed', () => {
    expect(planSync({
      deployed,
      current: { ...deployed, head: 'bbb' },
    })).toEqual({ deploy: true, rebuildDevContainer: false })
  })

  it('rebuilds dev-container when its pointer moved', () => {
    expect(planSync({
      deployed,
      current: { head: 'bbb', devContainer: 'd2' },
    })).toEqual({ deploy: true, rebuildDevContainer: true })
  })

  it('deploys when forced even if nothing changed', () => {
    expect(planSync({ deployed, current: deployed, force: true }).deploy).toBe(true)
  })
})

describe('renderPlist', () => {
  it('runs pnpm sync in the repo on an interval', () => {
    const plist = renderPlist({ root: '/srv/containers', intervalSeconds: 300 })
    expect(plist).toContain('cd \'/srv/containers\' &amp;&amp; pnpm sync')
    expect(plist).toContain('<integer>300</integer>')
  })
})
