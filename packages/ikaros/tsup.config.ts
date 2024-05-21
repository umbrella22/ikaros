import { defineConfig, type Options } from 'tsup'

const commonOptions: Options = {
  sourcemap: true,
  format: ['esm', 'cjs'],
  outDir: 'dist',
  clean: true,
  target: 'node18',
  splitting: false,
}

export default defineConfig(({ watch }) => {
  const isWatch = !!watch
  return [
    {
      ...commonOptions,
      entry: ['src/node/cli.ts', 'src/node/index.ts'],
      outDir: 'dist',
      sourcemap: isWatch,
      minify: !isWatch,
    },
    {
      ...commonOptions,
      entry: {
        index: 'src/node/index.ts',
      },
      outDir: 'dist',
      dts: { only: true },
    },
  ]
})
