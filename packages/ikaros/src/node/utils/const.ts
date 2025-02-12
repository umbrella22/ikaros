import chalk from 'chalk'
import { join } from 'path'

export const workPath = join(process.cwd(), './')
export const extensions = [
  '...',
  '.mjs',
  '.ts',
  '.js',
  '.jsx',
  '.tsx',
  '.json',
  '.node',
  '.vue',
]
export const tsConfig = join(workPath, 'tsconfig.json')

export const errorHeader = chalk.white.bold.bgRed(' ERROR ')
