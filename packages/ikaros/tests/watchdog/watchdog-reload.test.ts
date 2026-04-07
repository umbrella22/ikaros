import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import {
  Command,
  createCompileContext,
} from '../../src/node/compile/compile-context'
import {
  createCleanupRegistry,
  type CleanupRegistry,
} from '../../src/node/watchdog/cleanup-registry'
import { createWatchdog } from '../../src/node/watchdog/watchdog'

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe('Watchdog reload integration', () => {
  let tempDir: string
  let cleanupRegistry: CleanupRegistry

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'watchdog-reload-test-'))
    cleanupRegistry = createCleanupRegistry()

    mkdirSync(join(tempDir, 'env'))
    writeFileSync(join(tempDir, 'env', '.env'), 'FOO=one')
    writeFileSync(
      join(tempDir, 'config.shared.ts'),
      'export default { define: { CONFIG_VALUE: "one" } }',
    )
    writeFileSync(
      join(tempDir, 'ikaros.config.mjs'),
      'import shared from "./config.shared"\nexport default shared',
    )
  })

  afterEach(async () => {
    await cleanupRegistry.run().catch(() => {})
    delete process.env.FOO
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('重启后应重新读取更新后的配置和 env', async () => {
    const snapshots: Array<{
      foo: string | undefined
      configValue: unknown
    }> = []

    const loadContext = async () => {
      const ctx = await createCompileContext({
        command: Command.SERVER,
        context: tempDir,
        options: {
          platform: 'web',
        },
        registerCleanup: cleanupRegistry.register,
      })

      snapshots.push({
        foo: ctx.env.FOO as string | undefined,
        configValue: (ctx.userConfig?.define as Record<string, unknown>)
          ?.CONFIG_VALUE,
      })
    }

    await loadContext()

    let restartCount = 0
    const watchdog = createWatchdog({
      context: tempDir,
      onRestart: async () => {
        restartCount += 1
        await cleanupRegistry.run()
        await loadContext()
      },
      debounceMs: 100,
    })

    try {
      await wait(500)

      writeFileSync(join(tempDir, 'env', '.env.local'), 'FOO=two')
      writeFileSync(
        join(tempDir, 'config.shared.ts'),
        'export default { define: { CONFIG_VALUE: "two" } }',
      )

      await wait(1200)

      expect(restartCount).toBe(1)
      expect(snapshots).toEqual([
        { foo: 'one', configValue: 'one' },
        { foo: 'two', configValue: 'two' },
      ])
    } finally {
      await watchdog.close()
      await cleanupRegistry.run()
    }
  })
})
