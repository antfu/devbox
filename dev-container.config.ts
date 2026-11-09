import process from 'node:process'
import { defineConfig } from '@antfu/dev-container'

try {
  // Settings such as TAILNET_DOMAIN and GIT_NAME_BOT; the config itself is evaluated before envFile is read.
  process.loadEnvFile('.env')
}
catch {
  // .env is optional, the defaults below apply.
}

// With IMAGE_REGISTRY set (e.g. ghcr.io/<owner>/devbox), the paseo services pull the image that
// .github/workflows/images.yml builds, instead of building the toolchain, paseo and dev-base here.
const registry = process.env.IMAGE_REGISTRY?.replace(/\/$/, '')
const paseoImage = registry && `${registry}/paseo:${process.env.IMAGE_TAG || 'latest'}`

// Several laptops can run this stack on one tailnet. TAILNET_PREFIX (e.g. `mbp-`) goes in front of every
// tailnet hostname, so each laptop gets its own nodes (`mbp-paseo`, `mbp-monitor`), and its client only
// lists its own servers.
const prefix = process.env.TAILNET_PREFIX ?? ''
if (!/^[a-z0-9-]*$/.test(prefix))
  throw new Error(`TAILNET_PREFIX must hold only lowercase letters, digits and dashes, got "${prefix}"`)
const node = (name: string) => `${prefix}${name}`

// The GitHub accounts the servers act as. Each signs with its own key (`pnpm keys:setup <id>` writes
// keys/gpg/<id>), because GitHub only verifies a signature whose key belongs to the committer's account.
const identities = {
  bot: { name: process.env.GIT_NAME_BOT, email: process.env.GIT_EMAIL_BOT },
  main: { name: process.env.GIT_NAME_MAIN, email: process.env.GIT_EMAIL_MAIN },
}

// What the paseo daemons share: the dev-base toolchain (services/dev-base), and so the same agent setup around it.
const agentEnv = {
  // Signs commits and tags with the GPG key below; its gitconfig is git's system config.
  GIT_CONFIG_SYSTEM: '/etc/signing/gitconfig',
  // Vercel AI Gateway: pi and opencode read AI_GATEWAY_API_KEY themselves; Claude Code needs the
  // Anthropic-compatible endpoint, with ANTHROPIC_API_KEY emptied because it wins over the token.
  ...process.env.AI_GATEWAY_API_KEY && {
    AI_GATEWAY_API_KEY: { env: 'AI_GATEWAY_API_KEY' },
    ANTHROPIC_BASE_URL: 'https://ai-gateway.vercel.sh/claude-code',
    ANTHROPIC_AUTH_TOKEN: { env: 'AI_GATEWAY_API_KEY' },
    ANTHROPIC_API_KEY: '',
    CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY: '1',
  },
}

/**
 * A paseo daemon on the shared toolchain. Each one needs its own port, since the relay publishes it on the
 * host, and its own tailnet node. `githubToken` names the .env.secret variable that replaces the stack's
 * GITHUB_TOKEN_BOT for this daemon. `identity` picks the commit identity and signing key. A `client` only serves
 * the web UI: it gets no model keys, signing key, git identity or skills, since no agent runs there.
 */
function paseo({ name, port, githubToken, identity, client = false }: { name: string, port: number, githubToken?: string, identity?: keyof typeof identities, client?: boolean }) {
  const hostname = node(name)
  return {
    ...paseoImage
      ? { image: paseoImage }
      : { build: 'services/paseo' },
    env: {
      ...!client && agentEnv,
      // The global skills of services/paseo/skills.txt are installed on start, for the agents.
      ...client && { INSTALL_SKILLS: '0' },
      PASEO_LISTEN: `0.0.0.0:${port}`,
      // Checked by the daemon itself, so it has to live in the cage.
      PASEO_PASSWORD: { env: 'CLIENT_ACCESS_PASSWORD' },
      // Lets the daemon accept the tailnet hostname served by the Tailscale sidecar.
      PASEO_HOSTNAMES: '.ts.net',
      // The sidecar terminates TLS and sends X-Forwarded-Proto. Without trusting it, the web UI
      // takes its daemon connection as ws://<host>:80 instead of wss://<host>:443.
      PASEO_TRUSTED_PROXIES: 'loopback,uniquelocal',
      // The web UI's websocket comes from the tailnet origin, which the daemon rejects unless listed. The
      // servers also list paseo's origin, because the UI served there connects to them from the browser.
      ...process.env.TAILNET_DOMAIN && {
        PASEO_CORS_ORIGINS: [
          ...new Set([
            hostname,
            node('paseo'),
          ]),
        ].map(host => `https://${host}.${process.env.TAILNET_DOMAIN}`).join(','),
      },
    },
    ...githubToken && {
      secrets: {
        GITHUB_TOKEN: { env: githubToken },
      },
    },
    ports: [
      { port, tailnet: true },
    ],
    ...identity && { git: identities[identity] },
    // The home folder (logins, models, caches) lives on the host, where it is easy to back up.
    // The signing key is the identity's, made by `pnpm keys:setup`; dev-base's entrypoint imports it on every start.
    volumes: identity
      ? [`./keys/gpg/${identity}:/etc/signing:ro`]
      : [],
    persist: ['/home/paseo'],
    tailscale: { hostname },
  }
}

export default defineConfig({
  name: 'devbox',
  // The bot's GITHUB_TOKEN_BOT in .env.secret is brokered for git and gh, and the cage sees it as GITHUB_TOKEN
  // and GH_TOKEN, which the tools read; no service here uses npm.
  builtins: {
    github: {
      from: { env: 'GITHUB_TOKEN_BOT' },
    },
    npm: false,
  },
  // The dashboard's bearer token is the same CLIENT_ACCESS_PASSWORD as paseo's; unset, dev-container makes a random one.
  // The daemon (pnpm daemon:install) serves the dashboard, whose Upgrade button pulls, rebuilds and restarts.
  // The dashboard is also served at https://monitor.<tailnet>.ts.net by the tailscale-dashboard sidecar.
  dashboard: {
    token: process.env.CLIENT_ACCESS_PASSWORD || undefined,
    tailscale: {
      hostname: node('monitor'),
      domain: process.env.TAILNET_DOMAIN,
    },
  },
  selfUpgrade: {
    command: [
      'pnpm install --frozen-lockfile',
      'pnpm run build',
    ],
  },
  services: {
    // The client: the web UI you open, with paseo-bot and paseo-main added as its hosts. Run agents on those
    // two, so each account's repos and logins stay on its own daemon.
    'paseo': paseo({
      name: 'paseo',
      port: 6767,
      client: true,
    }),
    // The server for the bot account, on the stack's GITHUB_TOKEN_BOT.
    'paseo-bot': paseo({
      name: 'paseo-bot',
      port: 6769,
      identity: 'bot',
    }),
    // The server for the main GitHub account, a separate node with its own home. GITHUB_TOKEN_MAIN in
    // .env.secret is swapped in for it only; the other services keep GITHUB_TOKEN_BOT.
    'paseo-main': paseo({
      name: 'paseo-main',
      port: 6768,
      identity: 'main',
      githubToken: 'GITHUB_TOKEN_MAIN',
    }),
  },
})
