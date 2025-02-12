import { defineConfig, type Options } from 'tsup'

const commonOptions: Options = {
  sourcemap: true,
  format: ['esm'],
  outDir: 'dist',
  clean: true,
  target: 'node20',
  splitting: false,
  // 新增优化参数
  minifyWhitespace: true,
  keepNames: true,
}

export default defineConfig(({ watch }) => {
  const isWatch = !!watch
  return [
    {
      ...commonOptions,
      entry: ['src/node/index.ts'],
      outDir: 'dist',
      sourcemap: isWatch,
      minify: !isWatch,
      dts: true,
    },
  ]
})
