import { version, name } from '../../../package.json'
import chalk from 'chalk'
import { config, type DotenvParseOutput } from 'dotenv'
import { join } from 'node:path'
import fse from 'fs-extra'
import { isObject } from 'radash'

/**
 * cli package.json
 */
export const cliPackageJson = { version, name }

export const rootDir = process.cwd()

export const logStats = (proc: string, data: string) => {
  let log = ''

  log += chalk.yellow.bold(
    `┏ ${proc}  "Process" ${Array.from({ length: 19 - proc.length + 1 }).join('-')}`,
  )
  log += '\n\n'

  log += `  ${data}\n`

  log +=
    '\n' +
    chalk.yellow.bold(`┗ ${Array.from({ length: 28 + 1 }).join('-')}`) +
    '\n'
  console.log(log)
}

export const removeJunk = (chunk: string) => {
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

const getEnvPath = (mode?: string) => {
  if (!mode) {
    return join(rootDir, 'env', '.env')
  }
  return join(rootDir, 'env', `.${mode}.env`)
}

const checkEnv = async (mode?: string) => {
  const hasEnvFolder = await fse.pathExists(join(rootDir, 'env'))
  if (!hasEnvFolder) {
    console.log(chalk.yellow.bold('env folder not found'))
    return false
  }
  if (mode) {
    const hasEnv = await fse.pathExists(getEnvPath(mode))
    if (!hasEnv) {
      console.log(chalk.yellow.bold(`.env.${mode} file not found`))
      return false
    }
  } else {
    const hasEnv = await fse.pathExists(getEnvPath())
    if (!hasEnv) {
      console.log(chalk.yellow.bold('.env file not found'))
      return false
    }
    return true
  }
  return true
}

export const getEnv = async (mode?: string) => {
  const hasEnv = await checkEnv(mode)
  if (!hasEnv) {
    return {}
  }
  if (!mode) {
    return config({ path: getEnvPath() }).parsed ?? {}
  }
  return config({ path: getEnvPath(mode) }).parsed ?? {}
}

export const adapterEnv = (env: DotenvParseOutput) => {
  return Object.fromEntries(
    Object.entries(env).map(([key, val]) => {
      return [`import.meta.env.${key}`, `"${val}"`]
    }),
  )
}

export const mergeUserConfig = <T extends Record<string, any>>(
  target: T,
  source: T,
): T => {
  for (const key in source) {
    target[key] =
      isObject(source[key]) && key in target
        ? mergeUserConfig(target[key], source[key])
        : source[key]
  }
  return target
}
