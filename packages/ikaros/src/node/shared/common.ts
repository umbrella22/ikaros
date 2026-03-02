// shared/common.ts — 通用工具函数

import { isObject } from 'es-toolkit/compat'
import { createRequire } from 'node:module'
import { join } from 'path'

export const mergeUserConfig = <T extends Record<string, unknown>>(
  target: T,
  source: T,
): T => {
  const result = { ...target } as Record<string, unknown>
  const sourceRecord = source as Record<string, unknown>

  for (const key of Object.keys(sourceRecord)) {
    const sourceValue = sourceRecord[key]
    const targetValue = result[key]

    if (isObject(sourceValue) && isObject(targetValue)) {
      result[key] = mergeUserConfig(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>,
      )
    } else {
      result[key] = sourceValue
    }
  }

  return result as T
}

/**
 * 检查指定依赖是否存在（兼容 monorepo hoisted 场景）
 * @param {string} packageName 要检查的包名
 * @param {string} context 工作目录，默认为 process.cwd()
 * @returns {boolean} 是否存在
 */
export function checkDependency(
  packageName: string,
  context: string = process.cwd(),
): boolean {
  try {
    const contextRequire = createRequire(join(context, './'))
    contextRequire.resolve(packageName)
    return true
  } catch {
    return false
  }
}
