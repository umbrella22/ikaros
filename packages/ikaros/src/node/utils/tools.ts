import { version, name } from '../../../package.json'
import chalk from 'chalk'

/**
 * cli package.json
 */
export const cliPackageJson = { version, name }

export const rootDir = process.cwd()

export function logStats(proc: string, data: any) {
  let log = ''

  log += chalk.yellow.bold(
    `┏ ${proc}  "Process" ${Array.from({ length: 19 - proc.length + 1 }).join('-')}`,
  )
  log += '\n\n'

  if (typeof data === 'object') {
    data
      .toString({
        colors: true,
        chunks: false,
      })
      .split(/\r?\n/)
      .forEach((line: string) => {
        log += '  ' + line + '\n'
      })
  } else {
    log += `  ${data}\n`
  }

  log +=
    '\n' +
    chalk.yellow.bold(`┗ ${Array.from({ length: 28 + 1 }).join('-')}`) +
    '\n'
  console.log(log)
}

export function removeJunk(chunk: string) {
  // Example: 2018-08-10 22:48:42.866 Electron[90311:4883863] *** WARNING: Textured window <AtomNSWindow: 0x7fb75f68a770>
  if (
    /\d+-\d+-\d+ \d+:\d+:\d+\.\d+ Electron(?: Helper)?\[\d+:\d+] /.test(chunk)
  ) {
    return false
  }

  // Example: [90789:0810/225804.894349:ERROR:CONSOLE(105)] "Uncaught (in promise) Error: Could not instantiate: ProductRegistryImpl.Registry", source: chrome-devtools://devtools/bundled/inspector.js (105)
  if (/\[\d+:\d+\/|\d+\.\d+:ERROR:CONSOLE\(\d+\)]/.test(chunk)) {
    return false
  }

  // Example: ALSA lib confmisc.c:767:(parse_card) cannot find card '0'
  if (/ALSA lib [a-z]+\.c:\d+:\([_a-z]+\)/.test(chunk)) {
    return false
  }
  return chunk
}
