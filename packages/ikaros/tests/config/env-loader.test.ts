import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { getEnv } from '../../src/node/config/env-loader'

describe('getEnv', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'env-loader-test-'))
  })

  afterEach(() => {
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
    expect(result.warnings).toHaveLength(0)
  })

  it('应支持按 mode 加载 .env 文件', async () => {
    mkdirSync(join(tempDir, 'env'))
    writeFileSync(
      join(tempDir, 'env', '.env.production'),
      'NODE_ENV=production\nAPI=https://api.example.com',
    )
    const result = await getEnv(tempDir, 'production')
    expect(result.env).toEqual({
      NODE_ENV: 'production',
      API: 'https://api.example.com',
    })
    expect(result.warnings).toHaveLength(0)
  })

  it('当指定 mode 的 .env 文件不存在时应返回警告', async () => {
    mkdirSync(join(tempDir, 'env'))
    const result = await getEnv(tempDir, 'staging')
    expect(result.env).toEqual({})
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0].message).toContain('.env.staging file not found')
  })
})
