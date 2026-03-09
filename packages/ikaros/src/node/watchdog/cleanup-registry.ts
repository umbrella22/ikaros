// watchdog/cleanup-registry.ts — 清理函数注册表

type CleanupFn = () => Promise<void> | void

const registry: CleanupFn[] = []

/**
 * 注册一个清理函数
 *
 * 当看门狗触发重启时，所有注册的清理函数会先被执行。
 */
export function registerCleanup(fn: CleanupFn): void {
  registry.push(fn)
}

/**
 * 执行并清空所有已注册的清理函数
 *
 * 使用 Promise.allSettled 确保所有清理函数都有机会执行，
 * 即使其中某个抛出异常也不影响其他清理函数。
 * 如果存在失败的清理函数，会抛出聚合错误。
 */
export async function runCleanups(): Promise<void> {
  const fns = registry.splice(0)
  const results = await Promise.allSettled(fns.map(async (fn) => fn()))

  const failures = results.filter(
    (r): r is PromiseRejectedResult => r.status === 'rejected',
  )

  if (failures.length > 0) {
    const messages = failures.map((f) =>
      f.reason instanceof Error ? f.reason.message : String(f.reason),
    )
    throw new Error(
      `${failures.length} cleanup(s) failed:\n${messages.join('\n')}`,
    )
  }
}
