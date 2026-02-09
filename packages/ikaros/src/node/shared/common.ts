// shared/common.ts — 通用工具函数

import { isObject } from 'es-toolkit/compat'
import fsp from 'fs/promises'
import { join } from 'path'

export const mergeUserConfig = <T extends Record<string, unknown>>(
  target: T,
  source: T,
): T => {
  const targetRecord = target as Record<string, unknown>
  const sourceRecord = source as Record<string, unknown>

  for (const key of Object.keys(sourceRecord)) {
    const sourceValue = sourceRecord[key]
    const targetValue = targetRecord[key]

    if (isObject(sourceValue) && isObject(targetValue)) {
      targetRecord[key] = mergeUserConfig(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>,
      )
    } else {
      targetRecord[key] = sourceValue
    }
  }

  return target
}

/**
 * 检查指定依赖是否存在（Promise化）
 * @param {string} packageName 要检查的包名
 * @param {string} context 工作目录，默认为 process.cwd()
 * @returns {Promise<boolean>} 是否存在
 */
export async function checkDependency(
  packageName: string,
  context: string = process.cwd(),
): Promise<boolean> {
  try {
    const modulePath = join(context, 'node_modules', packageName)
    await fsp.access(modulePath, fsp.constants.F_OK)
    return true
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return false
    }
    throw error // 抛出非"文件不存在"的其他错误
  }
}
