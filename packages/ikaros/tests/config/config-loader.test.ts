import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
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

  it('应支持配置中导入带 import.meta 的 ESM 包依赖', async () => {
    const packageDir = join(tempDir, 'node_modules', 'fake-esm-plugin')

    mkdirSync(packageDir, { recursive: true })

    writeFileSync(
      join(tempDir, 'ikaros.config.mjs'),
      'import plugin from "fake-esm-plugin"\nexport default { define: { PLUGIN_URL: plugin.url } }',
    )
    writeFileSync(
      join(packageDir, 'package.json'),
      JSON.stringify({
        name: 'fake-esm-plugin',
        type: 'module',
        exports: './index.js',
      }),
    )
    writeFileSync(
      join(packageDir, 'index.js'),
      'export default { url: import.meta.url }',
    )

    const config = await resolveConfig({ context: tempDir })

    expect(config).toEqual({
      define: {
        PLUGIN_URL: expect.stringContaining(
          '/node_modules/fake-esm-plugin/index.js',
        ),
      },
    })
  })

  it('应支持配置中导入会继续依赖 ESM 包的 bare package', async () => {
    const pluginDir = join(tempDir, 'node_modules', 'fake-esm-plugin')
    const runtimeDir = join(tempDir, 'node_modules', 'fake-esm-runtime')

    mkdirSync(pluginDir, { recursive: true })
    mkdirSync(runtimeDir, { recursive: true })

    writeFileSync(
      join(tempDir, 'ikaros.config.mjs'),
      'import plugin from "fake-esm-plugin"\nexport default { define: { RUNTIME_URL: plugin.url } }',
    )
    writeFileSync(
      join(pluginDir, 'package.json'),
      JSON.stringify({
        name: 'fake-esm-plugin',
        type: 'module',
        exports: './index.js',
      }),
    )
    writeFileSync(
      join(pluginDir, 'index.js'),
      'export { default } from "fake-esm-runtime"',
    )
    writeFileSync(
      join(runtimeDir, 'package.json'),
      JSON.stringify({
        name: 'fake-esm-runtime',
        type: 'module',
        exports: './index.js',
      }),
    )
    writeFileSync(
      join(runtimeDir, 'index.js'),
      'export default { url: import.meta.url }',
    )

    const config = await resolveConfig({ context: tempDir })

    expect(config).toEqual({
      define: {
        RUNTIME_URL: expect.stringContaining(
          '/node_modules/fake-esm-runtime/index.js',
        ),
      },
    })
  })
})
