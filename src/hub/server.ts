import type { Server } from 'node:http'
import { createServer } from 'node:http'

const PAGE = `<!doctype html>
<meta charset="utf-8">
<title>hub</title>
<h1>hub</h1>
<p>Placeholder. The standalone hub UI will replace this service.</p>
`

/** Stand-in for the hub UI: a page at `/` and a health probe at `/health`. */
export function createHubServer(): Server {
  return createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ status: 'ok' }))
      return
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end(PAGE)
  })
}
