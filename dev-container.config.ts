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
  // .env holds what the containers receive; .env.secret holds what the broker and sidecars keep to themselves.
  envFile: ['.env', '.env.secret'],
  // GITHUB_TOKEN in .env.secret is brokered for git and gh; no service here uses npm.
  builtins: { npm: false },
  services: {
    // Placeholder until the standalone hub UI exists; same port as the real one.
    hub: {
      build: 'services/hub',
      ports: [
        { port: 8100, tailnet: 443 },
      ],
      tailscale: { hostname: 'hub' },
    },
    paseo: {
      build: 'services/paseo',
      env: {
        // Checked by the daemon itself, so it has to live in the cage.
        PASEO_PASSWORD: { env: 'PASEO_PASSWORD' },
        // Lets the daemon accept the tailnet hostname served by the Tailscale sidecar.
        PASEO_HOSTNAMES: '.ts.net',
        // The sidecar terminates TLS and sends X-Forwarded-Proto. Without trusting it, the web UI
        // takes its daemon connection as ws://<host>:80 instead of wss://<host>:443.
        PASEO_TRUSTED_PROXIES: 'loopback,uniquelocal',
        // Base64 GPG keys, imported at startup by services/paseo/git-setup.sh. Commits are signed only
        // when the private key is set, and the cage has to hold it.
        ...process.env.GPG_PRIVATE_KEY && { GPG_PRIVATE_KEY: process.env.GPG_PRIVATE_KEY },
        ...process.env.GPG_PUBLIC_KEY && { GPG_PUBLIC_KEY: process.env.GPG_PUBLIC_KEY },
        // Commit identity for the agents; GIT_NAME and GIT_EMAIL live in .env.
        ...process.env.GIT_NAME && { GIT_AUTHOR_NAME: process.env.GIT_NAME, GIT_COMMITTER_NAME: process.env.GIT_NAME },
        ...process.env.GIT_EMAIL && { GIT_AUTHOR_EMAIL: process.env.GIT_EMAIL, GIT_COMMITTER_EMAIL: process.env.GIT_EMAIL },
        // The web UI's websocket comes from the tailnet origin, which the daemon rejects unless listed.
        ...process.env.TAILNET_DOMAIN && { PASEO_CORS_ORIGINS: `https://paseo.${process.env.TAILNET_DOMAIN}` },
      },
      ports: [
        { port: 6767, tailnet: 443 },
      ],
      volumes: ['./workspace:/workspace'],
      persist: ['/home/paseo'],
      tailscale: { hostname: 'paseo' },
    },
    vi: {
      // Built from the vi submodule; its Dockerfile lives here because vi has none.
      build: { context: 'vendor/vi', dockerfile: '../../services/vi/Dockerfile' },
      env: {
        // vi's Vite server only answers hosts it knows; this adds the tailnet's.
        __VITE_ADDITIONAL_SERVER_ALLOWED_HOSTS: '.ts.net',
      },
      ports: [
        { port: 5656, tailnet: 443 },
      ],
      volumes: [`${resolve(process.env.VI_LIBRARY ?? './library')}:/app/example`],
      tailscale: { hostname: 'vi' },
    },
  },
})
