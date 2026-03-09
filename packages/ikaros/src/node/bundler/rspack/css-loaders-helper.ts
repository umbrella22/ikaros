import { type LightningcssLoaderOptions } from '@rspack/core'
import { resolveCliPath } from '../../shared/constants'

export interface CssLoaderOptions {
  lightningcss?: LightningcssLoaderOptions
  sourceMap?: boolean
  less?: Record<string, unknown>
  sass?: Record<string, unknown>
  stylus?: Record<string, unknown>
}

function createLoader(loader: string, options?: Record<string, unknown>) {
  return {
    loader: loader.includes('builtin')
      ? loader
      : resolveCliPath.resolve(loader),
    options,
  }
}

function cssLoaders(env: string, options?: CssLoaderOptions) {
  const { lightningcss, sourceMap } = options ?? {}
  const lightningcssLoader = createLoader('builtin:lightningcss-loader', {
    ...lightningcss,
  })

  const generateLoaders = (
    loader: string,
    loaderOptions?: Record<string, unknown>,
  ) => {
    const loaders = [lightningcssLoader]
    const rawOptions = options?.[loader as keyof CssLoaderOptions] as
      | Record<string, unknown>
      | undefined
    if (loader !== 'css') {
      loaders.push(
        createLoader(`${loader}-loader`, {
          ...rawOptions,
          ...loaderOptions,
          sourceMap,
        }),
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

export function buildCssLoaders(env: string, options?: CssLoaderOptions) {
  const loaders = cssLoaders(env, options)

  return Object.entries(loaders).map(([extension, loader]) => ({
    test: new RegExp(`\\.${extension}$`),
    use: loader,
    type: 'css/auto',
  }))
}
