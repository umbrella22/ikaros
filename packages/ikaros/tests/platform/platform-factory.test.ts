import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPlatformAdapter } from '../../src/node/platform/platform-factory'

describe('createPlatformAdapter', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('应为 "web" 返回 WebPlatformAdapter', () => {
    const adapter = createPlatformAdapter('web')
    expect(adapter.name).toBe('web')
    expect(typeof adapter.resolvePreConfig).toBe('function')
    expect(typeof adapter.compile).toBe('function')
  })

  it('未知平台应 fallback 到 WebPlatformAdapter', () => {
    const adapter = createPlatformAdapter('unknown')
    expect(adapter.name).toBe('web')
  })

  it('应为 "desktopClient" 返回延迟加载的适配器', () => {
    const adapter = createPlatformAdapter('desktopClient')
    expect(adapter.name).toBe('desktopClient')
    expect(typeof adapter.resolvePreConfig).toBe('function')
    expect(typeof adapter.compile).toBe('function')
  })

  it('desktopClient 应优先使用显式传入的 context 解析依赖', async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), 'ikaros-platform-'))
    const packageRoot = join(
      fixtureRoot,
      'node_modules',
      '@ikaros-cli',
      'ikaros-platform-desktop-client',
    )

    await mkdir(packageRoot, { recursive: true })
    await writeFile(
      join(packageRoot, 'package.json'),
      JSON.stringify({
        name: '@ikaros-cli/ikaros-platform-desktop-client',
        type: 'module',
        exports: './index.mjs',
      }),
    )
    await writeFile(join(packageRoot, 'index.mjs'), 'export default {}\n')

    const adapter = createPlatformAdapter('desktopClient', {
      context: fixtureRoot,
    })

    await expect(adapter.resolvePreConfig({} as never)).rejects.toThrowError(
      /已安装但加载失败：未找到 ElectronDesktopPlatformInstance 导出/,
    )

    await rm(fixtureRoot, { recursive: true, force: true })
  })
})
