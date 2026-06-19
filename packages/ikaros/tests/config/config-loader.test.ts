import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import {
  ConfigLoadError,
  resolveConfig,
  resolveConfigWatchFilesWithDiagnostics,
} from '../../src/node/config/config-loader'

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

  it('应将 defineConfig() 的 default undefined 视为空配置', async () => {
    writeFileSync(
      join(tempDir, 'ikaros.config.mjs'),
      'export default undefined',
    )

    expect(await resolveConfig({ context: tempDir })).toBeUndefined()
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

  it('应解析静态依赖并报告无法静态解析的动态 import', async () => {
    writeFileSync(
      join(tempDir, 'ikaros.config.mjs'),
      [
        'import shared from "./config.shared.mjs"',
        'const name = "dynamic"',
        'await import(`./${name}.mjs`)',
        'export default shared',
      ].join('\n'),
    )
    writeFileSync(join(tempDir, 'config.shared.mjs'), 'export default {}')

    const result = await resolveConfigWatchFilesWithDiagnostics({
      context: tempDir,
    })

    expect(result.files).toContain(join(tempDir, 'ikaros.config.mjs'))
    expect(result.files).toContain(join(tempDir, 'config.shared.mjs'))
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        file: join(tempDir, 'ikaros.config.mjs'),
        message: expect.stringContaining('dynamic import dependency'),
      }),
    ])
  })

  it('损坏的 executable 配置应抛出带路径和 cause 的加载错误', async () => {
    const configPath = join(tempDir, 'ikaros.config.mjs')
    writeFileSync(configPath, 'export default {')

    await expect(resolveConfig({ context: tempDir })).rejects.toMatchObject({
      name: 'ConfigLoadError',
      filePath: configPath,
      cause: expect.any(Error),
    })
    await expect(resolveConfig({ context: tempDir })).rejects.toThrow(
      configPath,
    )
  })

  it('损坏的 json 配置应抛出带路径和 cause 的加载错误', async () => {
    const configPath = join(tempDir, 'ikaros.config.json')
    writeFileSync(configPath, '{')

    await expect(resolveConfig({ context: tempDir })).rejects.toBeInstanceOf(
      ConfigLoadError,
    )
    await expect(resolveConfig({ context: tempDir })).rejects.toMatchObject({
      filePath: configPath,
      cause: expect.any(Error),
    })
  })

  it('损坏的 yaml 配置应抛出带路径和 cause 的加载错误', async () => {
    const configPath = join(tempDir, 'ikaros.config.yaml')
    writeFileSync(configPath, 'foo: [')

    await expect(resolveConfig({ context: tempDir })).rejects.toMatchObject({
      name: 'ConfigLoadError',
      filePath: configPath,
      cause: expect.any(Error),
    })
  })

  it('依赖扫描遇到语法错误时应写入 diagnostics 而不是抛出加载错误', async () => {
    const configPath = join(tempDir, 'ikaros.config.mjs')
    writeFileSync(configPath, 'export default {')

    const result = await resolveConfigWatchFilesWithDiagnostics({
      context: tempDir,
      configFile: configPath,
    })

    expect(result.files).toEqual([configPath])
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        file: configPath,
        message: expect.stringContaining('config dependency parse failed'),
      }),
    ])
  })

  it('应按 TypeScript 语法扫描 .cts 配置依赖', async () => {
    const configPath = join(tempDir, 'ikaros.config.cts')
    const sharedPath = join(tempDir, 'shared.ts')

    writeFileSync(
      configPath,
      [
        'import shared from "./shared"',
        'type Local = typeof shared',
        'export default shared satisfies Local',
      ].join('\n'),
    )
    writeFileSync(sharedPath, 'export default {}')

    const result = await resolveConfigWatchFilesWithDiagnostics({
      context: tempDir,
      configFile: configPath,
    })

    expect(result.files).toContain(configPath)
    expect(result.files).toContain(sharedPath)
    expect(result.diagnostics).toEqual([])
  })
})
