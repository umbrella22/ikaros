import { program } from 'commander'

import { version } from '../../package.json'
import * as compile from './compile/index'
import * as inspect from './inspect'
import * as migrate from './migrate'
import { assertNodeVersion } from './shared/check-env'
import { logger } from './shared/logger'

async function runCli(): Promise<void> {
  assertNodeVersion(22)

  program.version(version, '-v, --version')
  compile.commander(program)
  inspect.commander(program)
  migrate.commander(program)
  await program.parseAsync()
}

void runCli().catch((err) => {
  const message = err instanceof Error ? err.message : String(err)
  logger.error({ text: message })
  process.exitCode = 1
})
