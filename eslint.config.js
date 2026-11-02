// @ts-check
import antfu from '@antfu/eslint-config'

export default antfu(
  {
    type: 'app',
    pnpm: true,
    antislop: true,
    ignores: ['vendor'],
  },
  {
    // These are CLIs, a server and a Paseo plugin: stdout is their output (`paseo plugin logs` reads the plugin's).
    files: ['src/**/*.ts', 'services/*/plugins/**/*.ts'],
    rules: { 'no-console': 'off' },
  },
)
