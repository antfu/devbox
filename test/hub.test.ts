import type { AddressInfo } from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'
import { createHubServer } from '../src/hub/server'

const servers: ReturnType<typeof createHubServer>[] = []

async function start(): Promise<string> {
  const server = createHubServer()
  servers.push(server)
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`
}

afterEach(() => {
  servers.splice(0).forEach(server => server.close())
})

describe('hub stub', () => {
  it('answers the health probe', async () => {
    const res = await fetch(`${await start()}/health`)
    expect(await res.json()).toEqual({ status: 'ok' })
  })

  it('serves the placeholder page', async () => {
    const res = await fetch(await start())
    expect(res.headers.get('content-type')).toContain('text/html')
    expect(await res.text()).toContain('Placeholder')
  })
})
