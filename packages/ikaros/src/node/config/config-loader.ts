// config/config-loader.ts — 配置文件发现与加载

import { dirname, extname, isAbsolute, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parse } from 'yaml'
import fsp from 'node:fs/promises'
import fse from 'fs-extra'
import { type OxcError, transform } from 'oxc-transform'
import type { UserConfig } from './user-config'
import { CONFIG_FILE_NAME, CONFIG_FILE_SUFFIXES } from '../shared/constants'

async function transformConfig(path: string, isTs: boolean) {
  const filename = path
  const rawCode = await fsp.readFile(path, 'utf-8')
  const { code, errors } = await transform(filename, rawCode, {
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
    await fsp.unlink(fileNameTmp).catch(() => {})
  }
}

async function loadConfigAsTsOrMjs(filePath: string, isTs = false) {
  const { code } = await transformConfig(filePath, isTs)
  return requireConfig(filePath, code)
}

type FileType = '.mjs' | '.ts' | '.json' | '.yaml'

const CONFIG_DEPENDENCY_SUFFIXES = ['.mjs', '.js', '.ts', '.json', '.yaml']
const CONFIG_IMPORT_PATTERNS = [
  /(?:import|export)\s+(?:[^'"`]*?\s+from\s+)?['"]([^'"`]+)['"]/g,
  /import\s*\(\s*['"]([^'"`]+)['"]\s*\)/g,
  /require\(\s*['"]([^'"`]+)['"]\s*\)/g,
]

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
  return await loadConfigAsTsOrMjs(filePath, true)
})

fileType.set('.json', async (filePath) => {
  return await fse.readJson(filePath)
})

fileType.set('.yaml', async (filePath) => {
  const text = await fsp.readFile(filePath, 'utf8')
  return parse(text)
})

function resolveConfigInputPath(context: string, filePath: string): string {
  return isAbsolute(filePath) ? filePath : resolve(context, filePath)
}

export async function resolveConfigPath({
  configFile,
  context,
}: {
  configFile?: string
  context?: string
}): Promise<string | undefined> {
  const resolvedContext = context ?? process.cwd()

  if (configFile) {
    return resolveConfigInputPath(resolvedContext, configFile)
  }

  const configList = CONFIG_FILE_SUFFIXES.map((suffix) =>
    resolve(resolvedContext, `${CONFIG_FILE_NAME}.${suffix}`),
  )
  const results = await Promise.all(
    configList.map((element) => {
      return fse.pathExists(element)
    }),
  )
  const index = results.findIndex(Boolean)
  return index < 0 ? undefined : configList[index]
}

function extractConfigSpecifiers(code: string): string[] {
  const found = new Set<string>()

  for (const pattern of CONFIG_IMPORT_PATTERNS) {
    pattern.lastIndex = 0
    let match: RegExpExecArray | null = null
    while ((match = pattern.exec(code)) !== null) {
      const specifier = match[1]
      if (specifier?.startsWith('.')) {
        found.add(specifier)
      }
    }
  }

  return [...found]
}

async function resolveConfigDependencyPath(
  importer: string,
  specifier: string,
): Promise<string | undefined> {
  const basePath = resolve(dirname(importer), specifier)
  const suffix = extname(basePath)
  const candidates = suffix
    ? [basePath]
    : [
        ...CONFIG_DEPENDENCY_SUFFIXES.map((item) => `${basePath}${item}`),
        ...CONFIG_DEPENDENCY_SUFFIXES.map((item) =>
          join(basePath, `index${item}`),
        ),
      ]

  for (const candidate of candidates) {
    if (await fse.pathExists(candidate)) {
      return candidate
    }
  }

  return undefined
}

async function collectConfigDependencies(
  filePath: string,
  dependencies: Set<string>,
): Promise<void> {
  if (dependencies.has(filePath)) {
    return
  }
  dependencies.add(filePath)

  const suffix = extname(filePath)
  if (suffix === '.json' || suffix === '.yaml') {
    return
  }

  const code = await fsp.readFile(filePath, 'utf8')
  const specifiers = extractConfigSpecifiers(code)

  for (const specifier of specifiers) {
    const dependencyPath = await resolveConfigDependencyPath(
      filePath,
      specifier,
    )
    if (!dependencyPath) {
      continue
    }
    await collectConfigDependencies(dependencyPath, dependencies)
  }
}

export async function resolveConfigWatchFiles({
  configFile,
  context,
}: {
  configFile?: string
  context?: string
}): Promise<string[]> {
  const configPath = await resolveConfigPath({ configFile, context })
  if (!configPath) {
    return []
  }

  const dependencies = new Set<string>()
  await collectConfigDependencies(configPath, dependencies)
  return [...dependencies]
}

/**
 * @description 解析配置文件
 * @date 2024-05-22
 * @param {string} configFile 文件路径，可选，若不传入则会在项目根目录寻找配置文件
 * @returns {Promise<UserConfig | undefined>}
 */
export async function resolveConfig({
  configFile,
  context,
}: {
  configFile?: string
  context?: string
}): Promise<UserConfig | undefined> {
  const configPath = await resolveConfigPath({ configFile, context })
  if (!configPath) return undefined

  const suffix = extname(configPath) as FileType
  if (!fileType.has(suffix)) throw new Error('No configuration file ! ')
  return fileType.get(suffix)!(configPath)
}
