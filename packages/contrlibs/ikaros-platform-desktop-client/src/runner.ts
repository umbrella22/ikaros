import readline from 'node:readline'
import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'

export type BuildStatus = {
  success: boolean
  port?: number
  message?: string
}

export type DesktopClientDevParams = {
  entryFile: string
  startRendererDev: () => Promise<number>
  startMainDev: (options?: {
    onBuildStatus?: (status: BuildStatus) => void
  }) => Promise<void>
  startPreloadDev: (options?: {
    onBuildStatus?: (status: BuildStatus) => void
  }) => Promise<void>

  loadContextModule: <T>(id: string) => T

  /**
   * true: 仅手动重启（按 r）
   * false/undefined: 自动重启（监听到 main/preload rebuild 后重启）
   */
  controlledRestart?: boolean

  /** electron --inspect 端口 */
  inspectPort?: number
}

export type DesktopClientBuildParams = {
  buildMain: () => Promise<unknown>
  buildPreload: () => Promise<unknown>
  buildRenderer: () => Promise<unknown>
}

const removeJunk = (chunk: string): string | false => {
  if (
    /\d+-\d+-\d+ \d+:\d+:\d+\.\d+ Electron(?: Helper)?\[\d+:\d+] /.test(chunk)
  ) {
    return false
  }

  if (/\[\d+:\d+\/|\d+\.\d+:ERROR:CONSOLE\(\d+\)\]/.test(chunk)) {
    return false
  }

  if (/ALSA lib [a-z]+\.c:\d+:\([a-z_]+\)/.test(chunk)) {
    return false
  }

  return chunk
}

const resolveElectronBin = (
  loadContextModule: (id: string) => unknown,
): string => {
  const mod = loadContextModule('electron')

  if (typeof mod === 'string') return mod

  if (mod && typeof mod === 'object') {
    const maybeDefault = (mod as { default?: unknown }).default
    if (typeof maybeDefault === 'string') return maybeDefault
  }

  throw new Error(
    "Cannot resolve Electron binary from project dependency 'electron'.",
  )
}

const writeLine = (line = '') => {
  process.stdout.write(`${line}\n`)
}

const showHelp = (controlledRestart: boolean) => {
  const lines = [
    '可用快捷键：',
    `- r + 回车：${controlledRestart ? '重启主进程' : '（受控重启未启用）'}`,
    '- q + 回车：退出',
    '- h + 回车：显示帮助',
  ]
  writeLine(lines.join('\n'))
}

export const runDesktopClientDev = async (
  params: DesktopClientDevParams,
): Promise<void> => {
  const {
    entryFile,
    startRendererDev,
    startMainDev,
    startPreloadDev,
    loadContextModule,
    controlledRestart = false,
    inspectPort = 5858,
  } = params

  const rendererPort = await startRendererDev()

  // 兼容两种环境变量：
  process.env.RENDERER_PORT = String(rendererPort)
  process.env.PORT = String(rendererPort)

  let electronProcess: ChildProcess | null = null
  let manualStop = false
  let manualRestart = false
  let restartTimer: NodeJS.Timeout | undefined

  const restartElectron = () => {
    if (!electronProcess?.pid) {
      startElectron()
      return
    }

    manualRestart = true

    try {
      process.kill(electronProcess.pid)
    } catch {
      // ignore
    }

    electronProcess = null
    startElectron()

    setTimeout(() => {
      manualRestart = false
    }, 2000)
  }

  const requestRestart = () => {
    if (controlledRestart) return

    if (restartTimer) clearTimeout(restartTimer)
    restartTimer = setTimeout(() => {
      restartElectron()
    }, 200)
  }

  const startElectron = () => {
    const electronBin = resolveElectronBin(loadContextModule)

    const args = [`--inspect=${inspectPort}`, entryFile]

    electronProcess = spawn(electronBin, args, {
      stdio: ['inherit', 'pipe', 'pipe'],
    })

    electronProcess.stdout?.on('data', (buf: Buffer) => {
      const text = buf.toString()
      const cleaned = removeJunk(text)
      if (cleaned) process.stdout.write(cleaned)
    })

    electronProcess.stderr?.on('data', (buf: Buffer) => {
      const text = buf.toString()
      const cleaned = removeJunk(text)
      if (cleaned) process.stderr.write(cleaned)
    })

    electronProcess.on('close', () => {
      if (manualStop) return
      if (manualRestart) return
      process.exit(0)
    })
  }

  // 先启动 main/preload 的 watch（第一次 build 完成后再拉起 electron）
  await Promise.all([
    startMainDev({
      onBuildStatus: (status) => {
        if (status.success) requestRestart()
      },
    }),
    startPreloadDev({
      onBuildStatus: (status) => {
        if (status.success) requestRestart()
      },
    }),
  ])

  startElectron()

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  showHelp(controlledRestart)

  rl.on('line', (inputRaw) => {
    const input = String(inputRaw ?? '').trim()

    if (input === 'q') {
      manualStop = true
      try {
        if (electronProcess?.pid) process.kill(electronProcess.pid)
      } catch {
        // ignore
      }
      rl.close()
      process.exit(0)
    }

    if (input === 'h') {
      showHelp(controlledRestart)
      return
    }

    if (input === 'r') {
      if (!controlledRestart) {
        writeLine(
          '受控重启被禁用，请在启动时启用 controlledRestart 才可使用手动重启。',
        )
        return
      }
      restartElectron()
      return
    }
  })
}

export const runDesktopClientBuild = async (
  params: DesktopClientBuildParams,
): Promise<void> => {
  const { buildMain, buildPreload, buildRenderer } = params
  // main 默认会 clean 输出目录；preload 也输出到同一目录时并发可能导致 ENOTEMPTY
  await buildMain()
  await Promise.all([buildPreload(), buildRenderer()])
}
