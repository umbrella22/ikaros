import { join } from 'path'
import module from 'node:module'
import url from 'node:url'

export const workPath = join(process.cwd(), './')
export const extensions = [
  '...',
  '.css',
  '.less',
  '.sass',
  '.scss',
  '.mjs',
  '.jsx',
  '.ts',
  '.tsx',
  '.node',
  '.vue',
]
export const tsConfig = join(workPath, 'tsconfig.json')

/**
 * cli目录
 */
export const CLI_PATH = url.fileURLToPath(new url.URL('../', import.meta.url))

export const resolveCliPath: NodeJS.Require = module.createRequire(CLI_PATH)

/**
 * 基于cli的绝对定位
 * @param ...paths 子路径
 */
export const resolveCLI = (...paths: string[]) => join(CLI_PATH, ...paths)
