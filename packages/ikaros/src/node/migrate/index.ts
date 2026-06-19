import { Command } from 'commander'

import { migrateConfigFile } from '../config/migrate-config'
import { logger } from '../shared/logger'

export interface MigrateConfigCliOptions {
  config: string
  write?: boolean
  output?: string
}

export function commander(program: Command): void {
  program
    .command('migrate-config')
    .description('migrate ikaros v2 config fields to v3 semantic config')
    .requiredOption('-c, --config <file>', 'config file to migrate')
    .option('--write', 'overwrite the input config file')
    .option('-o, --output <file>', 'write migrated config to another file')
    .action(async (options: MigrateConfigCliOptions) => {
      const result = await migrateConfigFile({
        configFile: options.config,
        write: options.write,
        output: options.output,
      })

      for (const diagnostic of result.diagnostics) {
        const text = diagnostic.location
          ? `${diagnostic.message} (${diagnostic.location.start}-${diagnostic.location.end})`
          : diagnostic.message
        if (diagnostic.level === 'error') logger.error({ text })
        else if (diagnostic.level === 'warning') logger.warning({ text })
        else logger.info({ text })
      }

      if (result.outputFile) {
        logger.done({ text: `迁移后的配置已写入 ${result.outputFile}` })
        return
      }

      if (!result.changed) {
        logger.info({ text: '未生成变更。' })
        return
      }

      process.stdout.write(`${result.code}\n`)
    })
}
