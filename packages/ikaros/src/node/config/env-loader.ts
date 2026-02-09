// config/env-loader.ts — 环境变量加载

import fse from 'fs-extra'
import { join } from 'path'
import { config } from 'dotenv'

import { LoggerSystem } from '../shared/logger'

const getEnvPath = (context: string, mode?: string) => {
  if (!mode) {
    return join(context, 'env', '.env')
  }
  return join(context, 'env', `.env.${mode}`)
}

const checkEnv = async (context: string, mode?: string) => {
  const { warning, emitEvent } = LoggerSystem()
  const hasEnvFolder = await fse.pathExists(join(context, 'env'))
  if (!hasEnvFolder) {
    emitEvent(warning({ text: 'env folder not found', onlyText: true })!)
    return false
  }
  if (mode) {
    const hasEnv = await fse.pathExists(getEnvPath(context, mode))
    if (!hasEnv) {
      emitEvent(
        warning({ text: `.env.${mode} file not found`, onlyText: true })!,
      )
      return false
    }
  } else {
    const hasEnv = await fse.pathExists(getEnvPath(context))
    if (!hasEnv) {
      emitEvent(warning({ text: '.env file not found', onlyText: true })!)
      return false
    }
    return true
  }
  return true
}

/**
 * 加载环境变量
 * @param context 工作目录
 * @param mode 模式
 */
export const getEnv = async (context: string, mode?: string) => {
  const hasEnv = await checkEnv(context, mode)
  if (!hasEnv) {
    return {}
  }
  if (!mode) {
    return config({ path: getEnvPath(context), quiet: true }).parsed ?? {}
  }
  return config({ path: getEnvPath(context, mode), quiet: true }).parsed ?? {}
}
