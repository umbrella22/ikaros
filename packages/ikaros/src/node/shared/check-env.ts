// shared/check-env.ts — 环境检查工具

import chalk from 'chalk'

/**
 * 断言 Node.js 版本满足最低要求
 *
 * @param minMajor - 最低的主版本号
 * @throws 当 Node.js 版本低于要求时终止进程
 */
export function assertNodeVersion(minMajor: number): void {
  const major = Number(process.versions.node.split('.')[0])
  if (Number.isFinite(major) && major < minMajor) {
    const errorTip = chalk.bgRed.white(' ERROR ')
    process.stderr.write(
      `${errorTip} Node.js version must be greater than or equal to v${minMajor}! (current: v${process.versions.node})\n\n`,
    )
    process.exit(1)
  }
}

/**
 * 检查 Node.js 版本是否满足最低要求（不终止进程，抛出错误）
 *
 * @param minMajor - 最低的主版本号
 * @throws Error 当 Node.js 版本低于要求时
 */
export function checkNodeVersion(minMajor: number): void {
  const major = Number(process.versions.node.split('.')[0])
  if (Number.isFinite(major) && major < minMajor) {
    throw new Error(
      `Node.js >= ${minMajor} is required (current: v${process.versions.node})`,
    )
  }
}
