import { program } from 'commander'
import { version } from '../../package.json'

import * as compile from './compile/index'
export * from './user-config'

import chalk from 'chalk'

/** 识别版本 */
const majorVersion = Number(process.versions.node.split('.')[0])
if (majorVersion < 18) {
  const errorTip = chalk.bgRed.white(' ERROR ')
  console.error(errorTip + ' The Node.js version is greater than v18!')
  console.log()
  process.exit(1)
}

program.version(version, '-v, --version')

compile.commander(program)

program.parse()
