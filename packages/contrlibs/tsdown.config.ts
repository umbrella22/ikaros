import { defineConfig, type Options } from "tsdown";

const commonOptions: Options = {
  format: ["esm"],
  outDir: "dist",
  clean: true,
  target: "node20",
};

export default defineConfig(({ watch }) => {
  const isWatch = !!watch;
  return [
    {
      ...commonOptions,
      entry: ["src/index.ts"],
      outDir: "dist",
      sourcemap: isWatch,
      treeshake: !isWatch,
      minify: !isWatch,
      minifyWhitespace: !isWatch,
      keepNames: !isWatch,
      dts: true,
    },
  ];
});
