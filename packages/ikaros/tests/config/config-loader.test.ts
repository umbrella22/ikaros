import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { resolveConfig } from '../../src/node/config/config-loader'

describe('resolveConfig', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'config-loader-test-'))
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('应重新加载同一路径下变更后的 mjs 配置', async () => {
    const configPath = join(tempDir, 'ikaros.config.mjs')

    writeFileSync(configPath, 'export default { define: { VALUE: "one" } }')
    expect(await resolveConfig({ context: tempDir })).toEqual({
      define: { VALUE: 'one' },
    })

    writeFileSync(configPath, 'export default { define: { VALUE: "two" } }')
    expect(await resolveConfig({ context: tempDir })).toEqual({
      define: { VALUE: 'two' },
    })
  })

  it('应在配置依赖文件变更后返回新值', async () => {
    writeFileSync(
      join(tempDir, 'ikaros.config.mjs'),
      'import shared from "./config.shared"\nexport default shared',
    )
    writeFileSync(
      join(tempDir, 'config.shared.ts'),
      'export default { define: { VALUE: "one" } }',
    )

    expect(await resolveConfig({ context: tempDir })).toEqual({
      define: { VALUE: 'one' },
    })

    writeFileSync(
      join(tempDir, 'config.shared.ts'),
      'export default { define: { VALUE: "two" } }',
    )

    expect(await resolveConfig({ context: tempDir })).toEqual({
      define: { VALUE: 'two' },
    })
  })
})
