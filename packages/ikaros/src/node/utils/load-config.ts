import { dirname, extname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parse } from 'yaml'
import fsp from 'node:fs/promises'
import fse from 'fs-extra'
import { OxcError, transform } from 'oxc-transform'
import { readFile } from 'node:fs/promises'
import type { UserConfig } from '../user-config'

async function transformConfig(path: string, isTs: boolean) {
  const filename = path
  const rawCode = await readFile(path, 'utf-8')
  const { code, errors } = transform(filename, rawCode, {
    lang: isTs ? 'ts' : 'js',
  })
  if (errors.length > 0) {
    throw new Error(
      'Transformation failed: ' +
        errors.map((e: OxcError) => e.message).join(', '),
    )
  }
  return {
    code,
  }
}

async function requireConfig(fileName: string, code: string) {
  const fileBase = `${fileName}.timestamp-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`
  const fileNameTmp = `${fileBase}.mjs`
  const fileUrl = `${pathToFileURL(fileBase)}.mjs`
  await fsp.writeFile(fileNameTmp, code)
  try {
    const module = await import(fileUrl)
    return module.default
  } finally {
    await fsp.unlink(fileNameTmp) // Ignore errors
  }
}

async function resultConfig(filePath: string, isTs = false) {
  const { code } = await transformConfig(filePath, isTs)
  return requireConfig(filePath, code)
}

type FileType = '.mjs' | '.ts' | '.json' | '.yaml'

const fileType = new Map<
  FileType,
  (filePath: string) => Promise<UserConfig | undefined>
>()

fileType.set('.mjs', async (filePath) => {
  const fileUrl = pathToFileURL(filePath)
  const importedModule = await import(fileUrl.href)
  return importedModule.default
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
 * @returns {Promise<UserConfig | undefined>}
 */
export async function resolveConfig({
  configFile,
}: {
  configFile?: string
}): Promise<UserConfig | undefined> {
  let suffix: FileType | undefined
  let configPath = process.cwd()
  const configName = 'ikaros.config'

  const configList = ['ts', 'mjs', 'json', 'yaml'].map(
    (suffix) => `${join(configPath, configName)}.${suffix}`,
  )
  const results = await Promise.all(
    configList.map((element) => {
      return fse.pathExists(element)
    }),
  )
  const index = results.findIndex(Boolean)
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
