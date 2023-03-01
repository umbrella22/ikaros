import type { IkarosUserConfig, MainConfig } from '../config'
import { bold, yellow } from 'picocolors'
import { ChildProcess, spawn } from 'node:child_process'
import { buildRollupConfig } from '../utils/build-rollup-config'
import { buildViteConfig } from '../utils/build-vite-config'
import { watch as rollupWatch } from 'rollup'
import { join } from 'node:path'
import { store } from '../utils/constants'
import electron from 'electron'
const { rootDir } = store

export const watch = (config: IkarosUserConfig) => {
  const { main, renderer } = config
}

function startMain(main: MainConfig): Promise<void> {
  return new Promise((resolve, reject) => {
    const mainConfig = buildRollupConfig(main)
    const mainWatcher = rollupWatch(mainConfig)
    mainWatcher.on('change', (filename) => {
      logStats('Main-FileChange', filename)
    })
    mainWatcher.on('event', (event) => {
      if (event.code === 'END') {
        startElectron(join(rootDir, main.entryDir, 'main.js'))
        resolve()
      } else if (event.code === 'ERROR') {
        reject(event.error)
      }
    })
  })
}

let electronProcess: ChildProcess | null = null
let manualRestart = false
function startElectron(mainFilePath: string) {
  if (electronProcess) {
    manualRestart = true
    electronProcess.pid && process.kill(electronProcess.pid)
    electronProcess = null

    setTimeout(() => {
      manualRestart = false
    }, 5000)
  }
  electronProcess = spawn(electron as any, [mainFilePath, '--inspect=5858'])

  electronProcess.stdout?.on('data', (data: string) => {
    logStats('Main', removeJunk(data))
  })
  electronProcess.stderr?.on('data', (data: string) => {
    logStats('Main', removeJunk(data))
  })

  electronProcess.on('close', () => {
    if (!manualRestart) process.exit()
  })
}

function logStats(proc: string, data: any) {
  let log = ''

  log += bold(
    yellow(
      `┏ ${proc} 'Process' ${Array.from({
        length: 19 - proc.length + 1,
      }).join('-')}`,
    ),
  )
  log += '\n\n'

  if (typeof data === 'object') {
    for (const line of data
      .toString({
        colors: true,
        chunks: false,
      })
      .split(/\r?\n/)) {
      log += '  ' + line + '\n'
    }
  } else {
    log += `  ${data}\n`
  }

  log +=
    '\n' + bold(yellow(`┗ ${Array.from({ length: 28 + 1 }).join('-')}`)) + '\n'
  console.log(log)
}

function removeJunk(chunk: string): string {
  // Example: 2018-08-10 22:48:42.866 Electron[90311:4883863] *** WARNING: Textured window <AtomNSWindow: 0x7fb75f68a770>
  if (
    /\d+-\d+-\d+ \d+:\d+:\d+\.\d+ Electron(?: Helper)?\[\d+:\d+] /.test(chunk)
  ) {
    return ''
  }
  // Example: [90789:0810/225804.894349:ERROR:CONSOLE(105)] "Uncaught (in promise) Error: Could not instantiate: ProductRegistryImpl.Registry", source: chrome-devtools://devtools/bundled/inspector.js (105)
  if (/\[\d+:\d+\/|\d+\.\d+:ERROR:CONSOLE\(\d+\)]/.test(chunk)) {
    return ''
  }
  // Example: ALSA lib confmisc.c:767:(parse_card) cannot find card '0'
  if (/ALSA lib [a-z]+\.c:\d+:\([_a-z]+\)/.test(chunk)) {
    return ''
  }

  return chunk
}
