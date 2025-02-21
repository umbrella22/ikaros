import { type LightningcssLoaderOptions } from '@rspack/core'
import { resolveCliPath } from './const'

export interface CssLoaderOptions {
  lightningcss?: LightningcssLoaderOptions
  sourceMap?: boolean
  less?: Record<string, any>
  sass?: Record<string, any>
  stylus?: Record<string, any>
}

const createLoader = (loader: string, options?: any) => ({
  loader: loader.includes('builtin') ? loader : resolveCliPath.resolve(loader),
  options,
})

const cssLoaders = (env: string, options?: CssLoaderOptions) => {
  const { lightningcss, sourceMap } = options ?? {}
  // const cssLoader = createLoader("css-loader", { sourceMap, esModule: false });
  const lightningcssLoader = createLoader('builtin:lightningcss-loader', {
    ...lightningcss,
  })

  const generateLoaders = (loader: string, loaderOptions?: any) => {
    const loaders = [lightningcssLoader]
    // 这里的默认可以分离css，但是无法分配css文件夹，疑似rspackbug，暂时保留，等待后续讨论后开启
    // if (env === "production" && loader === "cssHack") {
    //   const miniCssLoader = createLoader(rspack.CssExtractRspackPlugin.loader);
    //   loaders.unshift(miniCssLoader, cssLoader);
    // }
    const rawOptions = options && (options as Record<string, any>)[`${loader}`]
    if (loader && loader !== 'css') {
      loaders.push(
        createLoader(
          `${loader}-loader`,
          Object.assign(rawOptions ?? {}, loaderOptions, {
            sourceMap,
          }),
        ),
      )
    }

    return loaders
  }

  return {
    less: generateLoaders('less'),
    sass: generateLoaders('sass', {
      sassOptions: {
        indentedSyntax: true,
        api: 'modern-compiler',
      },
    }),
    scss: generateLoaders('sass', {
      sassOptions: {
        api: 'modern-compiler',
      },
    }),
    stylus: generateLoaders('stylus'),
    styl: generateLoaders('stylus'),
    // cssHack: generateLoaders("cssHack"),
    css: generateLoaders('css'),
  }
}

export const buildCssLoaders = (env: string, options?: CssLoaderOptions) => {
  const loaders = cssLoaders(env, options)

  return Object.entries(loaders).map(([extension, loader]) => {
    // if (extension === "cssHack" && env === "production") {
    //   return {
    //     test: new RegExp(`\\.css$`),
    //     use: loader,
    //     type: "javascript/auto",
    //   };
    // }
    return {
      test: new RegExp(`\\.${extension}$`),
      use: loader,
      type: 'css/auto',
    }
  })
}
