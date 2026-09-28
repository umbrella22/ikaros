import { describe, expect, it } from 'vitest'
import { ikarosEslintRule } from '@ikaros-cli/eslint-plugin'

import { VueVersion } from '../../../../packages/eslint-plugin/src/common'
import { getVueEsLint } from '../../../../packages/eslint-plugin/src/vue-recommended'

function readAliasResolver(configs: ReturnType<typeof getVueEsLint>) {
  const config = configs.find((item) => item.name === 'ikaros/vue-recommended')
  return (
    config?.settings as
      | {
          'import-x/resolver'?: {
            alias?: {
              map?: Array<[string, string]>
              extensions?: string[]
            }
          }
        }
      | undefined
  )?.['import-x/resolver']?.alias
}

describe('tsRecommended', () => {
  it('应使用兼容的 TypeScript API 解析类型注解', () => {
    const config = ikarosEslintRule.configs
      .tsRecommended()
      .find((item) => item.name === 'ikaros/recommended-ts')
    const parser = config?.languageOptions?.parser

    expect(parser?.parseForESLint).toBeTypeOf('function')
    expect(() =>
      parser?.parseForESLint?.('export const count: number = 1', {
        sourceType: 'module',
      }),
    ).not.toThrow()
  })
})

describe('getVueEsLint', () => {
  it('默认应使用 @ 到当前项目 src 的别名', () => {
    const alias = readAliasResolver(getVueEsLint(VueVersion.v3))

    expect(alias?.map).toEqual([['@', expect.stringContaining('/src')]])
    expect(alias?.extensions).toContain('.vue')
  })

  it('应允许调用方覆盖 alias map 和 extensions', () => {
    const alias = readAliasResolver(
      getVueEsLint(VueVersion.v3, {
        alias: {
          map: [['~', '/workspace/app']],
          extensions: ['.ts'],
        },
      }),
    )

    expect(alias).toEqual({
      map: [['~', '/workspace/app']],
      extensions: ['.ts'],
    })
  })
})
