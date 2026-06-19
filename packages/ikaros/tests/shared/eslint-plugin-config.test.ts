import { describe, expect, it } from 'vitest'

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
