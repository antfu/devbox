import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // workspace/ and library/ are host mounts that can hold whole repos and videos.
    exclude: [
      ...configDefaults.exclude,
      'vendor/**',
      'workspace/**',
      'library/**',
      '.dev-container/**',
      // The paseo build and work trees are whole upstream checkouts.
      '.cache/**',
    ],
  },
})
