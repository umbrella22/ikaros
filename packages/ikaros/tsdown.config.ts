import { defineConfig, type UserConfig } from 'tsdown'

const commonOptions: UserConfig = {
  sourcemap: true,
  format: ['esm'],
  outDir: 'dist',
  clean: true,
  target: 'node20',
}

export default defineConfig(({ watch }) => {
  const isWatch = !!watch
  return [
    {
      ...commonOptions,
      entry: [
        'src/node/index.ts',
        'src/node/cli.ts',
        'src/node/entrypoints/config.ts',
        'src/node/entrypoints/plugin.ts',
        'src/node/entrypoints/adapter.ts',
        'src/node/entrypoints/testing.ts',
      ],
      outDir: 'dist',
      sourcemap: isWatch,
      minify: !isWatch,
      dts: true,
      minifyWhitespace: !isWatch,
      keepNames: !isWatch,
    },
  ]
})
