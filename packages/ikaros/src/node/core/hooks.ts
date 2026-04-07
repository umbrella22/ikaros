export type AsyncHookHandler<TArgs> = (args: TArgs) => void | Promise<void>

export type AsyncWaterfallHookHandler<TValue, TContext> = (
  value: TValue,
  context: TContext,
) => TValue | void | Promise<TValue | void>

type HookTap<THandler> = {
  name: string
  handler: THandler
}

export interface AsyncHook<TArgs> {
  tap: (name: string, handler: AsyncHookHandler<TArgs>) => void
  untap: (name: string) => void
  call: (args: TArgs) => Promise<void>
  getTapNames: () => string[]
}

export interface AsyncWaterfallHook<TValue, TContext = void> {
  tap: (
    name: string,
    handler: AsyncWaterfallHookHandler<TValue, TContext>,
  ) => void
  untap: (name: string) => void
  call: (value: TValue, context: TContext) => Promise<TValue>
  getTapNames: () => string[]
}

export function createAsyncHook<TArgs>(): AsyncHook<TArgs> {
  const taps: HookTap<AsyncHookHandler<TArgs>>[] = []

  const untap = (name: string) => {
    for (let index = taps.length - 1; index >= 0; index -= 1) {
      if (taps[index].name === name) {
        taps.splice(index, 1)
      }
    }
  }

  return {
    tap(name, handler) {
      taps.push({ name, handler })
    },

    untap,

    async call(args) {
      for (const tap of taps) {
        await tap.handler(args)
      }
    },

    getTapNames() {
      return taps.map((tap) => tap.name)
    },
  }
}

export function createAsyncWaterfallHook<
  TValue,
  TContext = void,
>(): AsyncWaterfallHook<TValue, TContext> {
  const taps: HookTap<AsyncWaterfallHookHandler<TValue, TContext>>[] = []

  const untap = (name: string) => {
    for (let index = taps.length - 1; index >= 0; index -= 1) {
      if (taps[index].name === name) {
        taps.splice(index, 1)
      }
    }
  }

  return {
    tap(name, handler) {
      taps.push({ name, handler })
    },

    untap,

    async call(value, context) {
      let current = value

      for (const tap of taps) {
        const next = await tap.handler(current, context)
        if (next !== undefined) {
          current = next
        }
      }

      return current
    },

    getTapNames() {
      return taps.map((tap) => tap.name)
    },
  }
}
