import { resolve } from 'node:path'
import process from 'node:process'
import { defineConfig } from '@antfu/dev-container'

try {
  // Non-secret settings such as VI_LIBRARY; the config itself is evaluated before envFile is read.
  process.loadEnvFile('.env')
}
catch {
  // .env is optional, the defaults below apply.
}

export default defineConfig({
  name: 'containers',
  // .env.secret holds TS_AUTHKEY and PASEO_PASSWORD and stays on the host.
  envFile: ['.env', '.env.secret'],
  // No service here calls GitHub or npm through the broker.
  builtins: { github: false, npm: false },
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
        // Lets the daemon accept the tailnet hostname served by the Tailscale sidecar.
        PASEO_HOSTNAMES: '.ts.net',
      },
      ports: [
        { port: 6767, tailnet: true },
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
        { port: 5656, tailnet: true },
      ],
      volumes: [`${resolve(process.env.VI_LIBRARY ?? './library')}:/app/example`],
      tailscale: { hostname: 'vi' },
    },
  },
})
