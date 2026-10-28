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
    // These are CLIs and a server: stdout is their output.
    files: ['src/**/*.ts'],
    rules: { 'no-console': 'off' },
  },
)
