import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import {
  Command,
  createCompileContext,
} from '../../src/node/compile/compile-context'

describe('createCompileContext', () => {
  let tempDir: string
  let originalMode: string | undefined

  beforeEach(() => {
    originalMode = process.env.MODE
    delete process.env.MODE
    tempDir = mkdtempSync(join(tmpdir(), 'ikaros-compile-context-test-'))
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
    if (originalMode === undefined) {
      delete process.env.MODE
    } else {
      process.env.MODE = originalMode
    }
  })

  it('未显式传入 mode 时不应用 undefined 覆盖 .env MODE', async () => {
    mkdirSync(join(tempDir, 'env'))
    writeFileSync(join(tempDir, 'env', '.env'), 'MODE=from-env')

    const ctx = await createCompileContext({
      command: Command.BUILD,
      context: tempDir,
      options: {
        platform: 'web',
      },
    })

    expect(ctx.env.MODE).toBe('from-env')
    ctx.envCleanup()
  })

  it('显式传入 mode 时应覆盖 .env MODE', async () => {
    mkdirSync(join(tempDir, 'env'))
    writeFileSync(join(tempDir, 'env', '.env'), 'MODE=from-env')

    const ctx = await createCompileContext({
      command: Command.BUILD,
      context: tempDir,
      options: {
        platform: 'web',
        mode: 'production',
      },
    })

    expect(ctx.env.MODE).toBe('production')
    ctx.envCleanup()
  })
})
