import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { getEnv } from '../../src/node/config/env-loader'

const TEST_ENV_KEYS = [
  'API',
  'BAR',
  'BAZ',
  'FOO',
  'LOCAL',
  'MODE_LOCAL',
  'MODE_ONLY',
  'NODE_ENV',
  'SHARED',
] as const

function clearInjectedEnv(): void {
  for (const key of TEST_ENV_KEYS) {
    delete process.env[key]
  }
}

describe('getEnv', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'env-loader-test-'))
    clearInjectedEnv()
  })

  afterEach(() => {
    clearInjectedEnv()
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('当 env 文件夹不存在时应返回空对象和警告', async () => {
    const result = await getEnv(tempDir)
    expect(result.env).toEqual({})
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0].message).toContain('env folder not found')
  })

  it('当 .env 文件不存在时应返回空对象和警告', async () => {
    mkdirSync(join(tempDir, 'env'))
    const result = await getEnv(tempDir)
    expect(result.env).toEqual({})
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0].message).toContain('.env file not found')
  })

  it('应正确加载 .env 文件', async () => {
    mkdirSync(join(tempDir, 'env'))
    writeFileSync(join(tempDir, 'env', '.env'), 'FOO=bar\nBAZ=qux')
    const result = await getEnv(tempDir)
    expect(result.env).toEqual({ FOO: 'bar', BAZ: 'qux' })
    expect(result.loadedFiles).toEqual([join(tempDir, 'env', '.env')])
    expect(result.keySources).toEqual({
      FOO: join(tempDir, 'env', '.env'),
      BAZ: join(tempDir, 'env', '.env'),
    })
    expect(process.env.FOO).toBe('bar')
    expect(process.env.BAZ).toBe('qux')
    expect(result.warnings).toHaveLength(0)
    result.cleanup()
  })

  it('应按优先级加载 env 链', async () => {
    mkdirSync(join(tempDir, 'env'))
    writeFileSync(join(tempDir, 'env', '.env'), 'SHARED=base\nLOCAL=base')
    writeFileSync(join(tempDir, 'env', '.env.local'), 'LOCAL=local')
    writeFileSync(
      join(tempDir, 'env', '.env.production'),
      'NODE_ENV=production\nAPI=https://api.example.com\nMODE_ONLY=mode',
    )
    writeFileSync(
      join(tempDir, 'env', '.env.production.local'),
      'API=https://local.example.com\nMODE_LOCAL=mode-local',
    )
    const result = await getEnv(tempDir, 'production')
    expect(result.env).toEqual({
      SHARED: 'base',
      LOCAL: 'local',
      NODE_ENV: 'production',
      API: 'https://local.example.com',
      MODE_ONLY: 'mode',
      MODE_LOCAL: 'mode-local',
    })
    expect(result.filePaths).toEqual([
      join(tempDir, 'env', '.env'),
      join(tempDir, 'env', '.env.local'),
      join(tempDir, 'env', '.env.production'),
      join(tempDir, 'env', '.env.production.local'),
    ])
    expect(result.loadedFiles).toEqual([
      join(tempDir, 'env', '.env'),
      join(tempDir, 'env', '.env.local'),
      join(tempDir, 'env', '.env.production'),
      join(tempDir, 'env', '.env.production.local'),
    ])
    expect(result.keySources).toEqual({
      SHARED: join(tempDir, 'env', '.env'),
      LOCAL: join(tempDir, 'env', '.env.local'),
      NODE_ENV: join(tempDir, 'env', '.env.production'),
      API: join(tempDir, 'env', '.env.production.local'),
      MODE_ONLY: join(tempDir, 'env', '.env.production'),
      MODE_LOCAL: join(tempDir, 'env', '.env.production.local'),
    })
    expect(result.warnings).toHaveLength(0)
    result.cleanup()
  })

  it('当指定 mode 的 .env 文件不存在时应返回警告', async () => {
    mkdirSync(join(tempDir, 'env'))
    const result = await getEnv(tempDir, 'staging')
    expect(result.env).toEqual({})
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0].message).toContain('.env.staging file not found')
  })

  it('再次加载时应更新 process.env 的值', async () => {
    mkdirSync(join(tempDir, 'env'))
    const envPath = join(tempDir, 'env', '.env')

    writeFileSync(envPath, 'FOO=one\nBAR=keep')
    const first = await getEnv(tempDir)
    expect(process.env.FOO).toBe('one')
    expect(process.env.BAR).toBe('keep')

    writeFileSync(envPath, 'FOO=two')
    first.cleanup()

    const second = await getEnv(tempDir)
    expect(second.env).toEqual({ FOO: 'two' })
    expect(process.env.FOO).toBe('two')
    expect(process.env.BAR).toBeUndefined()

    second.cleanup()
  })

  it('cleanup 应移除本轮注入的环境变量', async () => {
    mkdirSync(join(tempDir, 'env'))
    writeFileSync(join(tempDir, 'env', '.env'), 'FOO=bar')

    const result = await getEnv(tempDir)
    expect(process.env.FOO).toBe('bar')

    result.cleanup()

    expect(process.env.FOO).toBeUndefined()
  })

  it('cleanup 应恢复已有环境变量', async () => {
    process.env.FOO = 'from-shell'
    mkdirSync(join(tempDir, 'env'))
    writeFileSync(join(tempDir, 'env', '.env'), 'FOO=from-env')

    const result = await getEnv(tempDir)
    expect(process.env.FOO).toBe('from-env')

    result.cleanup()

    expect(process.env.FOO).toBe('from-shell')
  })
})
