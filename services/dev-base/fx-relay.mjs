#!/usr/bin/env -S node --use-env-proxy --disable-warning=UNDICI-EHPA
// Installed as `fx`. Runs the real fx binary (/opt/fx/fx) with its AI Gateway traffic relayed through the
// broker's proxy.
//
// The cage only reaches the internet through HTTPS_PROXY, and fx ignores it: it resolves hosts itself, fails
// with NameServerFailure and reports "Offline". So this starts an HTTP relay on a free loopback port, points
// fx at it with FX_GATEWAY_BASE_URL and FX_GATEWAY_CHAT_URL, and forwards each request to the gateway with
// Node's fetch, which honours the proxy (--use-env-proxy) and the broker's CA (NODE_EXTRA_CA_CERTS). Other fx
// traffic (web fetch, remote MCP servers, Codex and Grok logins, updates) still goes direct and fails.
//
// Without a proxy, or with FX_GATEWAY_BASE_URL already set, fx runs untouched.
// Drop this once fx honours HTTPS_PROXY: https://github.com/vercel-labs/fx/pull/1728
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import process from 'node:process'
import { Readable } from 'node:stream'

const FX = process.env.FX_REAL_BIN || '/opt/fx/fx'
const GATEWAY = 'https://ai-gateway.vercel.sh'
// fetch sets these itself, and it decodes the body, so the encoding headers must not be passed on either.
const SKIPPED_HEADERS = new Set([
  'host',
  'connection',
  'keep-alive',
  'proxy-connection',
  'transfer-encoding',
  'upgrade',
  'te',
  'trailer',
  'content-length',
  'accept-encoding',
  'content-encoding',
])

function forwardable(entries) {
  return Object.fromEntries([...entries].filter(([name]) => !SKIPPED_HEADERS.has(name)))
}

/** Forwards every request to the gateway, streaming both ways, so server-sent events arrive as they come. */
function startRelay() {
  const server = createServer(async (req, res) => {
    const abort = new AbortController()
    res.on('close', () => abort.abort())
    try {
      const hasBody = req.method !== 'GET' && req.method !== 'HEAD'
      const upstream = await fetch(GATEWAY + req.url, {
        method: req.method,
        headers: forwardable(Object.entries(req.headers)),
        body: hasBody
          ? Readable.toWeb(req)
          : undefined,
        duplex: 'half',
        signal: abort.signal,
      })
      res.writeHead(upstream.status, forwardable(upstream.headers))
      if (upstream.body)
        Readable.fromWeb(upstream.body).on('error', () => res.destroy()).pipe(res)
      else
        res.end()
    }
    catch (error) {
      if (!res.headersSent)
        res.writeHead(502, { 'content-type': 'text/plain' })
      res.end(`fx relay: ${error.cause?.message || error.message}\n`)
    }
  })
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => resolve(server))
  })
}

/** Runs fx with the given environment and leaves with its exit code, or its signal. */
function runFx(env) {
  // stdio is fx's own, so ACP over stdin/stdout and the interactive TUI pass straight through.
  const child = spawn(FX, process.argv.slice(2), { stdio: 'inherit', env })
  child.on('error', (error) => {
    process.stderr.write(`fx: could not start ${FX}: ${error.message}\n`)
    process.exit(127)
  })
  // The terminal sends Ctrl-C and Ctrl-\ to fx as well, so passing them on would deliver them twice.
  for (const signal of ['SIGINT', 'SIGQUIT'])
    process.on(signal, () => {})
  for (const signal of ['SIGTERM', 'SIGHUP'])
    process.on(signal, () => child.kill(signal))
  child.on('exit', (code, signal) => {
    if (signal) {
      process.removeAllListeners(signal)
      process.kill(process.pid, signal)
    }
    process.exit(code ?? 1)
  })
}

const env = { ...process.env }
if ((env.HTTPS_PROXY || env.https_proxy) && !env.FX_GATEWAY_BASE_URL) {
  startRelay().then((server) => {
    const base = `http://127.0.0.1:${server.address().port}`
    runFx({ ...env, FX_GATEWAY_BASE_URL: base, FX_GATEWAY_CHAT_URL: `${base}/v4/ai/language-model` })
  }, (error) => {
    process.stderr.write(`fx: could not start the gateway relay: ${error.message}\n`)
    process.exit(1)
  })
}
else {
  runFx(env)
}
