// watchdog/cleanup-registry.ts — 实例级清理函数注册表

export type CleanupFn = () => Promise<void> | void

export interface CleanupRegistry {
  register: (fn: CleanupFn) => void
  run: () => Promise<void>
}

export function createCleanupRegistry(): CleanupRegistry {
  const registry: CleanupFn[] = []

  return {
    register(fn) {
      registry.push(fn)
    },

    async run() {
      const fns = registry.splice(0)
      const results = await Promise.allSettled(fns.map(async (fn) => fn()))

      const failures = results.filter(
        (result): result is PromiseRejectedResult =>
          result.status === 'rejected',
      )

      if (failures.length === 0) {
        return
      }

      const messages = failures.map((failure) =>
        failure.reason instanceof Error
          ? failure.reason.message
          : String(failure.reason),
      )

      throw new Error(
        `${failures.length} cleanup(s) failed:\n${messages.join('\n')}`,
      )
    },
  }
}
