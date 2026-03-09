import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createWatchdog } from '../../src/node/watchdog/watchdog'

// 用于等待文件系统事件传播 + 防抖
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

describe('Watchdog', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'watchdog-test-'))
    // 创建 env 目录和默认配置文件
    mkdirSync(join(tempDir, 'env'))
    writeFileSync(join(tempDir, 'env', '.env'), 'FOO=bar')
    writeFileSync(join(tempDir, 'ikaros.config.mjs'), 'export default {}')
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('应能正常创建和关闭实例', async () => {
    const onRestart = vi.fn()
    const watchdog = createWatchdog({
      context: tempDir,
      onRestart,
      debounceMs: 100,
    })

    expect(watchdog).toBeDefined()
    expect(watchdog.close).toBeInstanceOf(Function)

    await watchdog.close()
  })

  it('配置文件变更应触发 onRestart', async () => {
    const onRestart = vi.fn().mockResolvedValue(undefined)
    const watchdog = createWatchdog({
      context: tempDir,
      onRestart,
      debounceMs: 100,
    })

    try {
      // 等待 chokidar ready
      await wait(300)
      onRestart.mockClear()

      // 修改配置文件
      writeFileSync(
        join(tempDir, 'ikaros.config.mjs'),
        'export default { bundler: "vite" }',
      )

      // 等待文件事件传播 + 防抖
      await wait(500)

      expect(onRestart).toHaveBeenCalled()
    } finally {
      await watchdog.close()
    }
  })

  it('env 文件变更应触发 onRestart', async () => {
    const onRestart = vi.fn().mockResolvedValue(undefined)
    const watchdog = createWatchdog({
      context: tempDir,
      onRestart,
      debounceMs: 100,
    })

    try {
      await wait(300)
      onRestart.mockClear()

      // 修改 env 文件
      writeFileSync(join(tempDir, 'env', '.env'), 'FOO=updated')

      // 等待文件事件传播 + 防抖
      await wait(500)

      expect(onRestart).toHaveBeenCalled()
    } finally {
      await watchdog.close()
    }
  })

  it('配置依赖文件变更应触发 onRestart', async () => {
    writeFileSync(
      join(tempDir, 'ikaros.config.mjs'),
      'import shared from "./config.shared.mjs"\nexport default shared',
    )
    writeFileSync(join(tempDir, 'config.shared.mjs'), 'export default { a: 1 }')

    const onRestart = vi.fn().mockResolvedValue(undefined)
    const watchdog = createWatchdog({
      context: tempDir,
      onRestart,
      debounceMs: 100,
    })

    try {
      await wait(500)
      onRestart.mockClear()

      writeFileSync(
        join(tempDir, 'config.shared.mjs'),
        'export default { a: 2 }',
      )

      await wait(500)

      expect(onRestart).toHaveBeenCalledTimes(1)
    } finally {
      await watchdog.close()
    }
  })

  it('非配置文件变更不应触发 onRestart', async () => {
    // 使用独立的临时目录，不含 env 目录，避免干扰
    const isolatedDir = mkdtempSync(join(tmpdir(), 'watchdog-isolated-'))
    writeFileSync(join(isolatedDir, 'ikaros.config.mjs'), 'export default {}')

    const onRestart = vi.fn().mockResolvedValue(undefined)
    const watchdog = createWatchdog({
      context: isolatedDir,
      onRestart,
      debounceMs: 100,
    })

    try {
      await wait(300)
      onRestart.mockClear()

      // 创建一个无关文件
      writeFileSync(join(isolatedDir, 'readme.md'), '# hello')

      await wait(500)

      expect(onRestart).not.toHaveBeenCalled()
    } finally {
      await watchdog.close()
      rmSync(isolatedDir, { recursive: true, force: true })
    }
  })

  it('onRestart 抛出异常不应导致看门狗崩溃', async () => {
    const onRestart = vi.fn().mockRejectedValue(new Error('restart failed'))
    const watchdog = createWatchdog({
      context: tempDir,
      onRestart,
      debounceMs: 100,
    })

    try {
      await wait(300)
      onRestart.mockClear()
      onRestart.mockRejectedValue(new Error('restart failed'))

      writeFileSync(
        join(tempDir, 'ikaros.config.mjs'),
        'export default { changed: true }',
      )

      await wait(500)

      expect(onRestart).toHaveBeenCalled()
    } finally {
      await watchdog.close()
    }
  })

  it('env 目录不存在时应正常启动', async () => {
    const noEnvDir = mkdtempSync(join(tmpdir(), 'watchdog-noenv-'))
    writeFileSync(join(noEnvDir, 'ikaros.config.mjs'), 'export default {}')

    const onRestart = vi.fn()
    const watchdog = createWatchdog({
      context: noEnvDir,
      onRestart,
      debounceMs: 100,
    })

    expect(watchdog).toBeDefined()
    await watchdog.close()
    rmSync(noEnvDir, { recursive: true, force: true })
  })

  it('非当前生效的 env 文件变更不应触发 onRestart', async () => {
    writeFileSync(join(tempDir, 'env', '.env.local'), 'FOO=local')

    const onRestart = vi.fn().mockResolvedValue(undefined)
    const watchdog = createWatchdog({
      context: tempDir,
      onRestart,
      debounceMs: 100,
    })

    try {
      await wait(300)
      onRestart.mockClear()

      writeFileSync(join(tempDir, 'env', '.env.local'), 'FOO=updated-local')

      await wait(500)

      expect(onRestart).not.toHaveBeenCalled()
    } finally {
      await watchdog.close()
    }
  })

  it('自定义 configFile 应被正确监听', async () => {
    const customConfig = join(tempDir, 'custom.config.mjs')
    writeFileSync(customConfig, 'export default {}')

    const onRestart = vi.fn().mockResolvedValue(undefined)
    const watchdog = createWatchdog({
      context: tempDir,
      configFile: customConfig,
      onRestart,
      debounceMs: 100,
    })

    try {
      await wait(300)
      onRestart.mockClear()

      writeFileSync(customConfig, 'export default { updated: true }')

      await wait(500)

      expect(onRestart).toHaveBeenCalled()
    } finally {
      await watchdog.close()
    }
  })

  it('防抖应合并连续的文件变更为单次重启', async () => {
    // 使用独立的临时目录，不含 env 目录，避免干扰
    const isolatedDir = mkdtempSync(join(tmpdir(), 'watchdog-debounce-'))
    writeFileSync(join(isolatedDir, 'ikaros.config.mjs'), 'export default {}')

    const onRestart = vi.fn().mockResolvedValue(undefined)
    const watchdog = createWatchdog({
      context: isolatedDir,
      onRestart,
      debounceMs: 500,
    })

    try {
      await wait(300)
      onRestart.mockClear()

      // 快速连续修改（间隔小于防抖窗口）
      writeFileSync(
        join(isolatedDir, 'ikaros.config.mjs'),
        'export default { a: 1 }',
      )
      await wait(100)
      writeFileSync(
        join(isolatedDir, 'ikaros.config.mjs'),
        'export default { a: 2 }',
      )
      await wait(100)
      writeFileSync(
        join(isolatedDir, 'ikaros.config.mjs'),
        'export default { a: 3 }',
      )

      // 等待防抖 + awaitWriteFinish 完成
      await wait(1200)

      // 应只触发一次重启（防抖合并）
      expect(onRestart).toHaveBeenCalledTimes(1)
    } finally {
      await watchdog.close()
      rmSync(isolatedDir, { recursive: true, force: true })
    }
  })
})
