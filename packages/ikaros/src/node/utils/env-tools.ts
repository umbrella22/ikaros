import fse from 'fs-extra'
import { join } from 'path'
import { config } from 'dotenv'

import { LoggerSystem } from './logger'

const getEnvPath = (mode?: string) => {
  if (!mode) {
    return join(rootDir, 'env', '.env')
  }
  return join(rootDir, 'env', `.env.${mode}`)
}

const checkEnv = async (mode?: string) => {
  const { warning, emitEvent } = LoggerSystem()
  const hasEnvFolder = await fse.pathExists(join(rootDir, 'env'))
  if (!hasEnvFolder) {
    emitEvent(warning({ text: 'env folder not found', onlyText: true })!)
    return false
  }
  if (mode) {
    const hasEnv = await fse.pathExists(getEnvPath(mode))
    if (!hasEnv) {
      emitEvent(
        warning({ text: `.env.${mode} file not found`, onlyText: true })!,
      )
      return false
    }
  } else {
    const hasEnv = await fse.pathExists(getEnvPath())
    if (!hasEnv) {
      emitEvent(warning({ text: '.env file not found', onlyText: true })!)
      return false
    }
    return true
  }
  return true
}

export const rootDir = process.cwd()

export const getEnv = async (mode?: string) => {
  const hasEnv = await checkEnv(mode)
  if (!hasEnv) {
    return {}
  }
  if (!mode) {
    return config({ path: getEnvPath(), quiet: true }).parsed ?? {}
  }
  return config({ path: getEnvPath(mode), quiet: true }).parsed ?? {}
}
