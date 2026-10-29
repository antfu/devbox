import { resolve } from 'node:path'
import process from 'node:process'
import { defineConfig } from '@antfu/dev-container'

try {
  // Settings such as VI_LIBRARY; the config itself is evaluated before envFile is read.
  process.loadEnvFile('.env')
}
catch {
  // .env is optional, the defaults below apply.
}

// What paseo and lody share: the dev-base toolchain (services/dev-base), and so the same agent setup around it.
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
const agentVolumes = [
  // The signing key, made by `pnpm keys:setup`; dev-base's entrypoint imports it on every start.
  './keys/gpg:/etc/signing:ro',
]
// Commit identity for the agents; GIT_NAME and GIT_EMAIL live in .env.
const git = { name: process.env.GIT_NAME, email: process.env.GIT_EMAIL }

export default defineConfig({
  name: 'containers',
  // GITHUB_TOKEN in .env.secret is brokered for git and gh; no service here uses npm.
  builtins: { npm: false },
  // The dashboard's bearer token is DEV_CONTAINER_DASHBOARD_TOKEN from .env, loaded above.
  // The daemon (pnpm daemon:install) serves the dashboard, whose Upgrade button pulls, rebuilds and restarts.
  // The dashboard is also served at https://monitor.<tailnet>.ts.net by the tailscale-dashboard sidecar.
  dashboard: {
    tailscale: { hostname: 'monitor', domain: process.env.TAILNET_DOMAIN },
  },
  selfUpgrade: {
    command: ['pnpm install --frozen-lockfile --ignore-scripts', 'pnpm run build:hub', 'pnpm run build:dev-base'],
  },
  services: {
    // Placeholder until the standalone hub UI exists; same port as the real one.
    hub: {
      build: 'services/hub',
      ports: [
        { port: 8100, tailnet: true },
      ],
      tailscale: { hostname: 'hub' },
    },
    paseo: {
      build: 'services/paseo',
      env: {
        ...agentEnv,
        // Checked by the daemon itself, so it has to live in the cage.
        PASEO_PASSWORD: { env: 'PASEO_PASSWORD' },
        // Lets the daemon accept the tailnet hostname served by the Tailscale sidecar.
        PASEO_HOSTNAMES: '.ts.net',
        // The sidecar terminates TLS and sends X-Forwarded-Proto. Without trusting it, the web UI
        // takes its daemon connection as ws://<host>:80 instead of wss://<host>:443.
        PASEO_TRUSTED_PROXIES: 'loopback,uniquelocal',
        // The web UI's websocket comes from the tailnet origin, which the daemon rejects unless listed.
        ...process.env.TAILNET_DOMAIN && { PASEO_CORS_ORIGINS: `https://paseo.${process.env.TAILNET_DOMAIN}` },
      },
      ports: [
        { port: 6767, tailnet: true },
      ],
      git,
      // The home folder (logins, models, caches) lives on the host, where it is easy to back up.
      volumes: [
        ...agentVolumes,
        // The global skills, installed on the host by `pnpm skills:sync` from services/paseo/skills.txt.
        // The folder is emptied and refilled in place, so a running paseo sees changes; link-skills links
        // them into the agents' home on every start.
        './skills:/opt/skills:ro',
      ],
      persist: ['/home/paseo'],
      tailscale: { hostname: 'paseo' },
    },
    // The Lody daemon (https://lody.ai) on the same toolchain. It only connects out to Lody, which serves
    // the UI, so it has no port and no tailnet node. Its home keeps the sign-in and the repos it clones.
    lody: {
      build: 'services/lody',
      env: {
        ...agentEnv,
        // A CLI token from the Lody app (Settings > Account). Optional: without it the sign-in link is
        // printed in the logs. The CLI sends it to Lody itself, so it has to live in the cage.
        LODY_AUTH: { env: 'LODY_AUTH', optional: true },
      },
      git,
      volumes: agentVolumes,
      persist: ['/home/paseo'],
    },
    vi: {
      // Built from the vi submodule; its Dockerfile lives here because vi has none.
      build: { context: 'vendor/vi', dockerfile: '../../services/vi/Dockerfile' },
      ports: [
        { port: 5656, tailnet: true },
      ],
      volumes: [`${resolve(process.env.VI_LIBRARY ?? './library')}:/app/example`],
      tailscale: { hostname: 'vi' },
    },
  },
})
