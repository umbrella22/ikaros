import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
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
    expect(typeof adapter.createPlans).toBe('function')
    expect(typeof adapter.run).toBe('function')
  })

  it('未知平台应 fallback 到 WebPlatformAdapter', () => {
    const adapter = createPlatformAdapter('unknown')
    expect(adapter.name).toBe('web')
  })

  it('应为 "desktopClient" 返回延迟加载的适配器', () => {
    const adapter = createPlatformAdapter('desktopClient')
    expect(adapter.name).toBe('desktopClient')
    expect(typeof adapter.createPlans).toBe('function')
    expect(typeof adapter.run).toBe('function')
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

    await expect(adapter.createPlans({} as never)).rejects.toThrowError(
      /已安装但加载失败：未找到有效的 ElectronDesktopPlatformInstance 导出/,
    )

    await rm(fixtureRoot, { recursive: true, force: true })
  })

  it('desktopClient 并发首次调用应只加载并实例化一次适配器', async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), 'ikaros-platform-'))
    const packageRoot = join(
      fixtureRoot,
      'node_modules',
      '@ikaros-cli',
      'ikaros-platform-desktop-client',
    )
    const counterFile = join(fixtureRoot, 'counter.txt')

    await mkdir(packageRoot, { recursive: true })
    await writeFile(
      join(packageRoot, 'package.json'),
      JSON.stringify({
        name: '@ikaros-cli/ikaros-platform-desktop-client',
        type: 'module',
        exports: './index.mjs',
      }),
    )
    await writeFile(
      join(packageRoot, 'index.mjs'),
      [
        "import { readFileSync, writeFileSync } from 'node:fs'",
        `const counterFile = ${JSON.stringify(counterFile)}`,
        "const current = Number(readFileSync(counterFile, 'utf8'))",
        "writeFileSync(counterFile, String(current + 1))",
        'export const ElectronDesktopPlatformInstance = {',
        "  name: 'desktopClient',",
        '  async createPlans() { return [] },',
        '  async run() {},',
        '}',
      ].join('\n'),
    )
    await writeFile(counterFile, '0')

    const adapter = createPlatformAdapter('desktopClient', {
      context: fixtureRoot,
    })

    await Promise.all([adapter.createPlans({} as never), adapter.run({} as never)])

    await expect(readFile(counterFile, 'utf8')).resolves.toBe('1')

    await rm(fixtureRoot, { recursive: true, force: true })
  })

  it('desktopClient 首次加载失败后应允许下一次重试', async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), 'ikaros-platform-'))
    const packageRoot = join(
      fixtureRoot,
      'node_modules',
      '@ikaros-cli',
      'ikaros-platform-desktop-client',
    )

    const adapter = createPlatformAdapter('desktopClient', {
      context: fixtureRoot,
    })

    await mkdir(packageRoot, { recursive: true })
    await writeFile(
      join(packageRoot, 'package.json'),
      JSON.stringify({
        name: '@ikaros-cli/ikaros-platform-desktop-client',
        type: 'module',
        exports: './index.mjs',
      }),
    )

    await expect(adapter.createPlans({} as never)).rejects.toThrow(
      '未安装可选依赖',
    )

    await writeFile(
      join(packageRoot, 'index.mjs'),
      [
        'export const ElectronDesktopPlatformInstance = {',
        "  name: 'desktopClient',",
        "  async createPlans() { return [{ id: 'renderer' }] },",
        '  async run() {},',
        '}',
      ].join('\n'),
    )

    await expect(adapter.createPlans({} as never)).resolves.toEqual([
      { id: 'renderer' },
    ])

    await rm(fixtureRoot, { recursive: true, force: true })
  })
})
