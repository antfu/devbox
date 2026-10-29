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

export default defineConfig({
  name: 'containers',
  // GITHUB_TOKEN in .env.secret is brokered for git and gh; no service here uses npm.
  builtins: { npm: false },
  // The dashboard's bearer token is DEV_CONTAINER_DASHBOARD_TOKEN from .env, loaded above.
  // The daemon (pnpm daemon:install) serves the dashboard and pulls, rebuilds and restarts every 5 minutes.
  // The dashboard is also served at https://monitor.<tailnet>.ts.net by the tailscale-dashboard sidecar.
  dashboard: {
    tailscale: { hostname: 'monitor', domain: process.env.TAILNET_DOMAIN },
  },
  selfUpgrade: {
    auto: true,
    command: ['pnpm install --frozen-lockfile --ignore-scripts', 'pnpm run build:hub'],
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
        // Checked by the daemon itself, so it has to live in the cage.
        PASEO_PASSWORD: { env: 'PASEO_PASSWORD' },
        // Which agents `skills add` installs for; see services/paseo/install-skills.
        SKILLS_AGENTS: 'claude-code opencode pi',
        // The CLI reports installs to its own service, which the cage has no need to reach.
        DISABLE_TELEMETRY: '1',
        // Lets the daemon accept the tailnet hostname served by the Tailscale sidecar.
        PASEO_HOSTNAMES: '.ts.net',
        GIT_CONFIG_SYSTEM: '/etc/paseo-keys/gpg/gitconfig',
        // Vercel AI Gateway: pi and opencode read AI_GATEWAY_API_KEY themselves; Claude Code needs the
        // Anthropic-compatible endpoint, with ANTHROPIC_API_KEY emptied because it wins over the token.
        ...process.env.AI_GATEWAY_API_KEY && {
          AI_GATEWAY_API_KEY: { env: 'AI_GATEWAY_API_KEY' },
          ANTHROPIC_BASE_URL: 'https://ai-gateway.vercel.sh/claude-code',
          ANTHROPIC_AUTH_TOKEN: { env: 'AI_GATEWAY_API_KEY' },
          ANTHROPIC_API_KEY: '',
          CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY: '1',
        },
        // The sidecar terminates TLS and sends X-Forwarded-Proto. Without trusting it, the web UI
        // takes its daemon connection as ws://<host>:80 instead of wss://<host>:443.
        PASEO_TRUSTED_PROXIES: 'loopback,uniquelocal',
        // The web UI's websocket comes from the tailnet origin, which the daemon rejects unless listed.
        ...process.env.TAILNET_DOMAIN && { PASEO_CORS_ORIGINS: `https://paseo.${process.env.TAILNET_DOMAIN}` },
      },
      ports: [
        { port: 6767, tailnet: true },
      ],
      // Commit identity for the agents; GIT_NAME and GIT_EMAIL live in .env.
      git: { name: process.env.GIT_NAME, email: process.env.GIT_EMAIL },
      // The home folder (logins, models, caches) lives on the host, where it is easy to back up.
      // Commits and tags are signed with the GPG key in ./keys/gpg (pnpm keys:setup). Its gitconfig is git's system config.
      volumes: [
        // Read on every start, so editing it needs a restart, not a rebuild.
        './services/paseo/skills.txt:/etc/paseo/skills.txt:ro',
        './keys/gpg:/etc/paseo-keys/gpg:ro',
      ],
      persist: ['/home/paseo'],
      tailscale: { hostname: 'paseo' },
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
