import type { HtmlTagDescriptor, Plugin, ResolvedConfig } from 'vite'

export interface UserOptions {
  // 是否开启devTools
  devTools?: boolean
}

export const viteMobileDevtoolsPlugin = (userOptions?: UserOptions) => {
  const { devTools } = userOptions ?? {}

  let tags: HtmlTagDescriptor[] = []
  return <Plugin>{
    name: '@ikaros-cli/mobile-devtools',
    configResolved(resolvedConfig: ResolvedConfig) {
      const { command } = resolvedConfig
      if (devTools && command.includes('serve')) {
        tags = [
          {
            tag: 'script',
            injectTo: 'head',
            attrs: {
              src: 'https://cdn.jsdelivr.net/npm/eruda',
            },
          },
          {
            tag: 'script',
            injectTo: 'body',
            children: `window.addEventListener('load', () => { eruda.init() })`,
          },
        ]
      }
    },
    transformIndexHtml(html) {
      return {
        html,
        tags,
      }
    },
  }
}
