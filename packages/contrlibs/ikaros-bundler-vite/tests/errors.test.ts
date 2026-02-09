import { describe, expect, it } from 'vitest'

import { BundlerError } from '../src/errors'

describe('BundlerError', () => {
  it('should have name = "BundlerError"', () => {
    const err = new BundlerError('test', 'build')
    expect(err.name).toBe('BundlerError')
  })

  it('should capture phase', () => {
    const err = new BundlerError('fail', 'dev')
    expect(err.phase).toBe('dev')
    expect(err.message).toBe('fail')
  })

  it('should capture cause', () => {
    const cause = new Error('original')
    const err = new BundlerError('wrapped', 'config', { cause })
    expect(err.cause).toBe(cause)
  })

  it('should be instanceof Error', () => {
    const err = new BundlerError('test', 'build')
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(BundlerError)
  })
})
