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
      entry: ['src/index.ts'],
      sourcemap: isWatch,
      minify: !isWatch,
      dts: true,
      minifyWhitespace: !isWatch,
      keepNames: !isWatch,
    },
  ]
})
