import { dirname, extname, isAbsolute, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import { parse } from 'yaml'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import fse from 'fs-extra'
import { build } from 'esbuild'
import type { IkarosUserConfig } from '../user-config'

async function transformConfig(input: string, isESM = false) {
  const result = await build({
    absWorkingDir: process.cwd(),
    entryPoints: [input],
    outfile: 'out.js',
    write: false,
    platform: 'node',
    bundle: true,
    format: isESM ? 'esm' : 'cjs',
    sourcemap: 'inline',
    metafile: true,
    plugins: [
      // 对裸模块，进行 external 处理，即不打包到 bundle
      {
        name: 'externalize-deps',
        setup(build) {
          build.onResolve({ filter: /.*/ }, (args) => {
            const id = args.path
            // 排除相对路径和绝对路径
            if (!id.startsWith('.') && !isAbsolute(id)) {
              return {
                external: true,
              }
            }
          })
        },
      },
      // 省略其他插件
    ],
  })

  const { text } = result.outputFiles[0]
  return {
    code: text,
    dependencies: result.metafile ? Object.keys(result.metafile.inputs) : [],
  }
}

interface NodeModuleWithCompile extends NodeModule {
  _compile(code: string, filename: string): any
}
const _require = createRequire(pathToFileURL(resolve()))
async function requireConfig(fileName: string, code: string, isESM = false) {
  if (isESM) {
    const fileBase = `${fileName}.timestamp-${Date.now()}-${Math.random()
      .toString(16)
      .slice(2)}`
    const fileNameTmp = `${fileBase}.mjs`
    const fileUrl = `${pathToFileURL(fileBase)}.mjs`
    await fsp.writeFile(fileNameTmp, code)
    try {
      return (await import(fileUrl)).default
    } finally {
      fs.unlink(fileNameTmp, () => {}) // Ignore errors
    }
  }

  const extension = extname(fileName)
  const realFileName = fs.realpathSync(fileName)
  const loaderExt = extension in _require.extensions ? extension : '.js'

  // 保存老的 require 行为
  const defaultLoader = _require.extensions[loaderExt]!
  // 临时重写当前配置文件后缀的 require 行为
  _require.extensions[loaderExt] = (module: NodeModule, filename: string) => {
    // 只处理配置文件
    if (filename === realFileName) {
      // 直接调用 compile，传入编译好的代码
      ;(module as NodeModuleWithCompile)._compile(code, filename)
    } else {
      defaultLoader(module, filename)
    }
  }
  // 清除缓存
  // eslint-disable-next-line unicorn/prefer-module
  delete require.cache[require.resolve(fileName)]
  const raw = _require(fileName)
  // 恢复原生require行为
  _require.extensions[loaderExt] = defaultLoader
  // 如果是esm编译过的__esModule为true
  return raw.__esModule ? raw.default : raw
}

async function resultConfig(filePath: string, isESM = false) {
  const { code } = await transformConfig(filePath, isESM)
  return requireConfig(filePath, code, isESM)
}

type FileType = '.mjs' | '.ts' | '.json' | '.yaml'

const fileType = new Map<FileType, (filePath: string) => Promise<any>>()

// fileType.set('.js', async (filePath) => {
//   const pkg = await fse.readJson(resolve(process.cwd(), 'package.json'))
//   const { type = 'commonjs' } = pkg
//   return new Promise((resolve) => {
//     if (type === 'module') {
//       const fileUrl = pathToFileURL(filePath)
//       import(fileUrl.href)
//         .then((config) => config?.default)
//         .then(resolve)
//     }

//     // commonjs
//     resultConfig(filePath).then(resolve)
//   })
// })

fileType.set('.mjs', async (filePath) => {
  const fileUrl = pathToFileURL(filePath)
  return (await import(fileUrl.href)).default
})

fileType.set('.ts', async (filePath) => {
  return await resultConfig(filePath, true)
})

fileType.set('.json', async (filePath) => {
  return await fse.readJson(filePath)
})

fileType.set('.yaml', async (filePath) => {
  const text = await fsp.readFile(filePath, 'utf8')
  return parse(text)
})

/**
 * @description 解析配置文件
 * @date 2024-05-22
 * @param {string} configFile 文件路径，可选，若不传入则会在项目根目录寻找配置文件
 * @returns {Promise<IkarosUserConfig | undefined>}
 */
export async function resolveConfig({
  configFile,
}: {
  configFile?: string
}): Promise<IkarosUserConfig | undefined> {
  let suffix: FileType | undefined
  let configPath = process.cwd()
  const configName = 'ikaros.config'

  const configList = ['ts', 'mjs', 'json', 'yaml'].map(
    (suffix) => `${join(configPath, configName)}.${suffix}`,
  )
  const index = (
    await Promise.all(
      configList.map((element) => {
        return fse.pathExists(element)
      }),
    )
  ).findIndex(Boolean)
  if (index < 0) return undefined

  suffix = extname(configList[index]) as FileType

  configPath = resolve(configPath, `${configName}${suffix}`)

  if (configFile) {
    configPath = dirname(configFile)
    suffix = extname(configFile) as FileType
  }

  if (!fileType.has(suffix)) throw new Error('No configuration file ! ')
  return fileType.get(suffix)!(configPath)
}
