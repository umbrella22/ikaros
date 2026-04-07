import { program } from 'commander'

import { version } from '../../package.json'
import * as compile from './compile/index'
import * as inspect from './inspect'
import { assertNodeVersion } from './shared/check-env'

function runCli(): void {
  assertNodeVersion(22)

  program.version(version, '-v, --version')
  compile.commander(program)
  inspect.commander(program)
  program.parse()
}

runCli()
