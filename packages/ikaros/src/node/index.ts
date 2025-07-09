import { program } from 'commander'
import { version } from '../../package.json'

import * as compile from './compile/index'
export * from './user-config'

import { LoggerSystem } from '@ikaros-cli/infra-contrlibs'

const { error } = new LoggerSystem()
/** 识别版本 */
const majorVersion = Number(process.versions.node.split('.')[0])
if (majorVersion < 20) {
  error({
    text: 'The Node.js version is greater than v20!',
  })
  throw new Error('The Node.js version is greater than v20!')
}

program.version(version, '-v, --version')

compile.commander(program)

program.parse()
