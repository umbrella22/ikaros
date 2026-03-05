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
