import { dirname, extname, isAbsolute, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import { parse } from 'yaml'
import { pathExists, readFile, readJson, realpathSync } from 'fs-extra'
import { build } from 'esbuild'

const dynamicImport = (file: string) => import(file)

async function transformConfig(input: string) {
  const result = await build({
    absWorkingDir: process.cwd(),
    entryPoints: [input],
    outfile: 'out.js',
    write: false,
    platform: 'node',
    bundle: true,
    format: 'cjs',
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
async function requireConfig(filename: string, code: string) {
  const extension = extname(filename)
  const realFileName = realpathSync(filename)
  const loaderExt = extension in _require.extensions ? extension : '.js'

  // 保存老的 require 行为
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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
  delete require.cache[require.resolve(filename)]
  const raw = _require(filename)
  // 恢复原生require行为
  _require.extensions[loaderExt] = defaultLoader
  // 如果是esm编译过的__esModule为true
  return raw.__esModule ? raw.default : raw
}

function resultConfig(filePath: string) {
  return new Promise((resolve) => {
    transformConfig(filePath)
      .then(({ code }) => {
        return requireConfig(filePath, code)
      })
      .then(resolve)
  })
}

type FileType = '.js' | '.mjs' | '.cjs' | '.ts' | '.json' | '.yaml'

const fileType = new Map<FileType, (filePath: string) => Promise<any>>()

fileType.set('.js', async (filePath) => {
  const pkg = await readJson(resolve(process.cwd(), 'package.json'))
  const { type = 'commonjs' } = pkg
  return new Promise((resolve) => {
    if (type === 'module') {
      const fileUrl = pathToFileURL(filePath)
      dynamicImport(fileUrl.href)
        .then((config) => config?.default)
        .then(resolve)
    }

    // commonjs
    resultConfig(filePath).then(resolve)
  })
})

fileType.set('.mjs', (filePath) => {
  return new Promise((resolve) => {
    const fileUrl = pathToFileURL(filePath)
    dynamicImport(fileUrl.href)
      .then((config) => config?.default)
      .then(resolve)
  })
})

fileType.set('.cjs', resultConfig)

fileType.set('.ts', resultConfig)

fileType.set('.json', (filePath) => {
  return new Promise((resolve) => {
    readJson(filePath).then(resolve)
  })
})

fileType.set('.yaml', (filePath) => {
  return new Promise((resolve) => {
    readFile(filePath, 'utf8')
      .then((text: string) => parse(text))
      .then(resolve)
  })
})

/**
 * 描述
 * @date 2022-12-13
 * @param {any} configPath:string  需要读取配置的路径
 * @param {any} configName?:string  配置文件名
 * @returns {any}
 */
export async function resolveConfig({
  configPath,
  configName,
}: {
  configPath: string
  configName?: string
}) {
  configPath ?? (configPath = process.cwd())

  let suffix = extname(configPath) as FileType

  if (!suffix && !configName) throw new Error('请检查传入的参数，参数不规范！')

  if (configName) {
    suffix.includes('.') && (configPath = dirname(configPath))

    const configList = ['ts', 'mjs', 'cjs', 'js', 'json', 'yaml'].map(
      (suffix) => `${join(configPath, configName)}.${suffix}`,
    )

    const index = (
      await Promise.all(configList.map((element) => pathExists(element)))
    )
      // eslint-disable-next-line unicorn/no-await-expression-member
      .findIndex(Boolean)
    if (index < 0) throw new Error('No configuration file ! ')

    suffix = extname(configList[index]) as FileType

    configPath = resolve(configPath, `${configName}${suffix}`)
  }

  if (!fileType.has(suffix)) throw new Error('No configuration file ! ')

  return fileType.get(suffix)!(configPath)
}
