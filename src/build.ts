import { run } from './shell'

/**
 * Build the images the stack needs. The toolchain, paseo-base and dev-base chain is only built here when
 * the paseo image is not prebuilt; the broker and relay always build from dev-container's own contexts.
 */
export function buildImages(prebuilt: boolean): void {
  if (!prebuilt) {
    for (const script of ['build:toolchain', 'build:paseo', 'build:dev-base'])
      run('pnpm', ['run', script])
  }
  run('pnpm', ['dc', 'generate'])
  run('pnpm', ['dc', 'compose', 'build'])
}
