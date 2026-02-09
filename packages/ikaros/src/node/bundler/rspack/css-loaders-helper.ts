import { type LightningcssLoaderOptions } from '@rspack/core'
import { resolveCliPath } from '../../shared/constants'

export interface CssLoaderOptions {
  lightningcss?: LightningcssLoaderOptions
  sourceMap?: boolean
  less?: Record<string, unknown>
  sass?: Record<string, unknown>
  stylus?: Record<string, unknown>
}

const createLoader = (loader: string, options?: Record<string, unknown>) => ({
  loader: loader.includes('builtin') ? loader : resolveCliPath.resolve(loader),
  options,
})

const cssLoaders = (env: string, options?: CssLoaderOptions) => {
  const { lightningcss, sourceMap } = options ?? {}
  const lightningcssLoader = createLoader('builtin:lightningcss-loader', {
    ...lightningcss,
  })

  const generateLoaders = (
    loader: string,
    loaderOptions?: Record<string, unknown>,
  ) => {
    const loaders = [lightningcssLoader]
    const rawOptions =
      options && (options as Record<string, never>)[`${loader}`]
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
    css: generateLoaders('css'),
  }
}

export const buildCssLoaders = (env: string, options?: CssLoaderOptions) => {
  const loaders = cssLoaders(env, options)

  return Object.entries(loaders).map(([extension, loader]) => {
    return {
      test: new RegExp(`\\.${extension}$`),
      use: loader,
      type: 'css/auto',
    }
  })
}
