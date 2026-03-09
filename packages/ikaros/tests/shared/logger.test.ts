import { describe, it, expect } from 'vitest'
import { LoggerSystem } from '../../src/node/shared/logger'

describe('LoggerSystem', () => {
  it('应返回单例实例', () => {
    const a = LoggerSystem()
    const b = LoggerSystem()
    expect(a).toBe(b)
  })

  it('应包含所有日志方法', () => {
    const logger = LoggerSystem()
    expect(typeof logger.done).toBe('function')
    expect(typeof logger.error).toBe('function')
    expect(typeof logger.okay).toBe('function')
    expect(typeof logger.warning).toBe('function')
    expect(typeof logger.info).toBe('function')
  })

  it('onlyText 为 true 时应返回格式化字符串而不打印', () => {
    const logger = LoggerSystem()
    const result = logger.done({ text: 'only text', onlyText: true })
    expect(result).toContain('only text')
    expect(result).toContain('DONE')
  })

  it('各日志方法的 onlyText 应包含对应标签', () => {
    const logger = LoggerSystem()
    expect(logger.done({ text: 'msg', onlyText: true })).toContain('DONE')
    expect(logger.error({ text: 'msg', onlyText: true })).toContain('ERROR')
    expect(logger.okay({ text: 'msg', onlyText: true })).toContain('OKAY')
    expect(logger.warning({ text: 'msg', onlyText: true })).toContain('WARNING')
    expect(logger.info({ text: 'msg', onlyText: true })).toContain('INFO')
  })

  it('onlyText 结果应包含传入的文本', () => {
    const logger = LoggerSystem()
    expect(logger.error({ text: 'custom error', onlyText: true })).toContain(
      'custom error',
    )
    expect(logger.warning({ text: 'custom warn', onlyText: true })).toContain(
      'custom warn',
    )
    expect(logger.info({ text: 'custom info', onlyText: true })).toContain(
      'custom info',
    )
    expect(logger.okay({ text: 'custom okay', onlyText: true })).toContain(
      'custom okay',
    )
  })

  it('非 onlyText 模式应返回 undefined', () => {
    const logger = LoggerSystem()
    // 非 onlyText 时函数会调用 console 并返回 undefined
    const result = logger.done({ text: 'test' })
    expect(result).toBeUndefined()
  })
})
