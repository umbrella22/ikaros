// config/env-loader.ts — 环境变量加载

import fsp from 'node:fs/promises'
import { join } from 'path'

import { parse } from 'dotenv'
import fse from 'fs-extra'

import type { PreWarning } from '../plugins/pre-warnings-plugin'

const NOOP_CLEANUP = () => {}

export interface EnvDiagnostics {
  filePaths: string[]
  loadedFiles: string[]
  keySources: Record<string, string>
}

export function getEnvDir(context: string): string {
  return join(context, 'env')
}

export function getEnvFiles(context: string, mode?: string): string[] {
  const envDir = getEnvDir(context)
  const envFiles = [join(envDir, '.env'), join(envDir, '.env.local')]

  if (!mode) {
    return envFiles
  }

  return [
    ...envFiles,
    join(envDir, `.env.${mode}`),
    join(envDir, `.env.${mode}.local`),
  ]
}

function getPrimaryEnvFileName(mode?: string): string {
  return mode ? `.env.${mode}` : '.env'
}

async function resolveEnvFiles(
  context: string,
  warnings: PreWarning[],
  mode?: string,
): Promise<string[]> {
  const envDir = getEnvDir(context)
  const hasEnvFolder = await fse.pathExists(envDir)
  if (!hasEnvFolder) {
    warnings.push({ source: 'env-loader', message: 'env folder not found' })
    return []
  }

  const filePaths = getEnvFiles(context, mode)
  const existsList = await Promise.all(
    filePaths.map((filePath) => fse.pathExists(filePath)),
  )
  const existingFiles = filePaths.filter((_, index) => existsList[index])

  if (existingFiles.length === 0) {
    warnings.push({
      source: 'env-loader',
      message: `${getPrimaryEnvFileName(mode)} file not found`,
    })
  }

  return existingFiles
}

export type EnvResult = {
  env: Record<string, string>
  warnings: PreWarning[]
  cleanup: () => void
} & EnvDiagnostics

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
  const filePaths = getEnvFiles(context, mode)
  const existingFiles = await resolveEnvFiles(context, warnings, mode)

  if (existingFiles.length === 0) {
    return {
      env: {},
      warnings,
      filePaths,
      loadedFiles: [],
      keySources: {},
      cleanup: NOOP_CLEANUP,
    }
  }

  const env: Record<string, string> = {}
  const keySources: Record<string, string> = {}
  for (const filePath of existingFiles) {
    const parsed = parse(await fsp.readFile(filePath, 'utf8'))

    for (const [key, value] of Object.entries(parsed)) {
      env[key] = value
      keySources[key] = filePath
    }
  }

  const previousValues = new Map<string, string | undefined>()
  for (const [key, value] of Object.entries(env)) {
    if (!previousValues.has(key)) {
      previousValues.set(key, process.env[key])
    }

    process.env[key] = value
  }

  return {
    env,
    warnings,
    filePaths,
    loadedFiles: existingFiles,
    keySources,
    cleanup: () => {
      for (const [key, previousValue] of previousValues) {
        if (previousValue === undefined) {
          delete process.env[key]
          continue
        }

        process.env[key] = previousValue
      }
    },
  }
}
