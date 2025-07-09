import { type LightningcssLoaderOptions } from "@rspack/core";
import { resolveCliPath } from "./const";

export interface CssLoaderOptions {
  lightningcss?: LightningcssLoaderOptions;
  sourceMap?: boolean;
  less?: Record<string, any>;
  sass?: Record<string, any>;
  stylus?: Record<string, any>;
}

const createLoader = (loader: string, options?: any) => ({
  loader: loader.includes("builtin") ? loader : resolveCliPath.resolve(loader),
  parallel: !loader.includes("sass"),
  options,
});

const cssLoaders = (env: string, options?: CssLoaderOptions) => {
  const { lightningcss, sourceMap } = options ?? {};
  const lightningcssLoader = createLoader("builtin:lightningcss-loader", {
    ...lightningcss,
  });

  const generateLoaders = (loader: string, loaderOptions?: any) => {
    const loaders = [lightningcssLoader];
    const rawOptions = options && (options as Record<string, any>)[`${loader}`];
    if (loader && loader !== "css") {
      loaders.push(
        createLoader(
          `${loader}-loader`,
          Object.assign(rawOptions ?? {}, loaderOptions, {
            sourceMap,
          })
        )
      );
    }

    return loaders;
  };

  return {
    less: generateLoaders("less"),
    sass: generateLoaders("sass", {
      sassOptions: {
        indentedSyntax: true,
        api: "modern-compiler",
      },
    }),
    scss: generateLoaders("sass", {
      sassOptions: {
        api: "modern-compiler",
      },
    }),
    stylus: generateLoaders("stylus"),
    styl: generateLoaders("stylus"),
    css: generateLoaders("css"),
  };
};

export const buildCssLoaders = (env: string, options?: CssLoaderOptions) => {
  const loaders = cssLoaders(env, options);

  return Object.entries(loaders).map(([extension, loader]) => {
    return {
      test: new RegExp(`\\.${extension}$`),
      use: loader,
      type: "css/auto",
    };
  });
};
