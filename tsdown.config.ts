import { defineConfig } from 'tsdown'

/** The hub stub is the only thing that ships as built output: its Dockerfile copies the bundle. */
export default defineConfig({
  entry: { hub: 'src/hub/main.ts' },
  outDir: 'services/hub/dist',
  platform: 'node',
  dts: false,
})
