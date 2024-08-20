import type { HtmlTagDescriptor, Plugin } from 'vite'

export interface UserOptions {
  // options
  injectTags?: HtmlTagDescriptor[]
}
export const viteHtmlInjectPlugin = (userOptions?: UserOptions) => {
  const { injectTags } = userOptions ?? {}
  const tags: HtmlTagDescriptor[] = [
    {
      tag: 'meta',
      injectTo: 'head-prepend',
      attrs: {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1.0',
      },
    },
  ]
  tags.concat(injectTags ?? [])
  return <Plugin>{
    name: '@ikaros-cli/vite-html-inject-plugin',
    transformIndexHtml(html) {
      return {
        html,
        tags,
      }
    },
  }
}
