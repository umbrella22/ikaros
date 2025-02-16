import rspack, { type LightningcssLoaderOptions } from '@rspack/core'
import { resolveCliPath } from './const'

export interface CssLoaderOptions {
  lightningcssOptions?: LightningcssLoaderOptions
  sourceMap?: boolean
  lessOptions?: Record<string, unknown>
  sassOptions?: Record<string, unknown>
  stylusOptions?: Record<string, unknown>
}

const createLoader = (loader: string, options?: unknown) => ({
  loader: loader.includes('builtin') ? loader : resolveCliPath.resolve(loader),
  options,
})

const cssLoaders = (env: string, options?: CssLoaderOptions) => {
  const { lightningcssOptions, sourceMap } = options ?? {}
  const cssLoader = createLoader('css-loader', { sourceMap, esModule: false })
  const lightningcssLoader = createLoader('builtin:lightningcss-loader', {
    ...lightningcssOptions,
  })

  const generateLoaders = (loader: string, loaderOptions?: unknown) => {
    const loaders = [lightningcssLoader]

    if (env !== 'production') {
      const vueStyleLoader = createLoader('vue-style-loader', {})
      loaders.unshift(vueStyleLoader, cssLoader)
    } else {
      const miniCssLoader = createLoader(rspack.CssExtractRspackPlugin.loader)
      loaders.unshift(miniCssLoader, cssLoader)
    }
    const rawOptions =
      options && (options as Record<string, unknown>)[`${loader}Options`]
    if (loader) {
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
      indentedSyntax: true,
      api: 'modern-compiler',
      implementation: resolveCliPath.resolve('sass-embedded'),
    }),
    scss: generateLoaders('sass', {
      api: 'modern-compiler',
      implementation: resolveCliPath.resolve('sass-embedded'),
    }),
    stylus: generateLoaders('stylus'),
    styl: generateLoaders('stylus'),
  }
}

export const buildCssLoaders = (env: string, options?: CssLoaderOptions) => {
  const loaders = cssLoaders(env, options)

  return Object.entries(loaders).map(([extension, loader]) => ({
    test: new RegExp(`\\.${extension}$`),
    use: loader,
    type: 'javascript/auto',
  }))
}
