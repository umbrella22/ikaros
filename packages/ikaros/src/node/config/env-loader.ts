// config/env-loader.ts — 环境变量加载

import fse from 'fs-extra'
import { join } from 'path'
import { config } from 'dotenv'
import type { PreWarning } from '../plugins/pre-warnings-plugin'

export function getEnvDir(context: string): string {
  return join(context, 'env')
}

export function getEnvFiles(context: string, mode?: string): string[] {
  if (!mode) {
    return [join(context, 'env', '.env')]
  }
  return [join(context, 'env', `.env.${mode}`)]
}

function getEnvPath(context: string, mode?: string): string {
  return getEnvFiles(context, mode)[0]
}

async function checkEnv(
  context: string,
  warnings: PreWarning[],
  mode?: string,
): Promise<boolean> {
  const hasEnvFolder = await fse.pathExists(getEnvDir(context))
  if (!hasEnvFolder) {
    warnings.push({ source: 'env-loader', message: 'env folder not found' })
    return false
  }

  const envPath = getEnvPath(context, mode)
  const hasEnv = await fse.pathExists(envPath)
  if (!hasEnv) {
    const fileName = mode ? `.env.${mode}` : '.env'
    warnings.push({
      source: 'env-loader',
      message: `${fileName} file not found`,
    })
    return false
  }
  return true
}

export type EnvResult = {
  env: Record<string, string>
  warnings: PreWarning[]
}

/**
 * 加载环境变量
 * @param context 工作目录
 * @param mode 模式
 */
export async function getEnv(
  context: string,
  mode?: string,
): Promise<EnvResult> {
  const warnings: PreWarning[] = []
  const hasEnv = await checkEnv(context, warnings, mode)
  if (!hasEnv) {
    return { env: {}, warnings }
  }
  return {
    env: config({ path: getEnvPath(context, mode), quiet: true }).parsed ?? {},
    warnings,
  }
}
