// config/config-loader.ts — 配置文件发现与加载

import { dirname, extname, isAbsolute, join, resolve } from 'node:path'

import fsp from 'node:fs/promises'
import fse from 'fs-extra'
import { createJiti } from 'jiti'
import { parse } from 'yaml'

import type { UserConfig } from './user-config'
import { CONFIG_FILE_NAME, CONFIG_FILE_SUFFIXES } from '../shared/constants'

type FileType =
  | '.mjs'
  | '.js'
  | '.cjs'
  | '.ts'
  | '.mts'
  | '.cts'
  | '.json'
  | '.yaml'

const EXECUTABLE_CONFIG_SUFFIXES = new Set<FileType>([
  '.mjs',
  '.js',
  '.cjs',
  '.ts',
  '.mts',
  '.cts',
])

const CONFIG_DEPENDENCY_SUFFIXES: FileType[] = [
  '.mjs',
  '.js',
  '.cjs',
  '.ts',
  '.mts',
  '.cts',
  '.json',
  '.yaml',
]
const CONFIG_IMPORT_PATTERNS = [
  /(?:import|export)\s+(?:[^'"`]*?\s+from\s+)?['"]([^'"`]+)['"]/g,
  /import\s*\(\s*['"]([^'"`]+)['"]\s*\)/g,
  /require\(\s*['"]([^'"`]+)['"]\s*\)/g,
]

const BASE_NATIVE_MODULES = ['@rspack/core', 'typescript']

function createConfigLoader(nativeModules: string[]) {
  return createJiti(import.meta.url, {
    moduleCache: false,
    interopDefault: true,
    nativeModules,
    tryNative: false,
  })
}

async function loadConfigAsExecutable(
  filePath: string,
): Promise<UserConfig | undefined> {
  const nativeModules = await resolveConfigNativeModules(filePath)
  const configLoader = createConfigLoader(nativeModules)
  const loadedModule = configLoader(filePath) as
    | UserConfig
    | { default?: UserConfig }
    | undefined

  if (
    loadedModule &&
    typeof loadedModule === 'object' &&
    'default' in loadedModule &&
    loadedModule.default !== undefined
  ) {
    return loadedModule.default
  }

  return loadedModule as UserConfig | undefined
}

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
      if (specifier) {
        found.add(specifier)
      }
    }
  }

  return [...found]
}

function isRelativeConfigSpecifier(specifier: string): boolean {
  return specifier.startsWith('.')
}

function isBareModuleSpecifier(specifier: string): boolean {
  return !specifier.startsWith('.') && !specifier.startsWith('/')
}

function resolveNativeModuleCandidates(specifier: string): string[] {
  const candidates = new Set<string>([specifier])

  if (specifier.startsWith('@')) {
    const [scope, name] = specifier.split('/')
    if (scope && name) {
      candidates.add(`${scope}/${name}`)
    }
  } else {
    candidates.add(specifier.split('/')[0])
  }

  return [...candidates]
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
    if (!isRelativeConfigSpecifier(specifier)) {
      continue
    }

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

async function collectConfigNativeModules(
  filePath: string,
  nativeModules: Set<string>,
  visitedFiles: Set<string>,
): Promise<void> {
  if (visitedFiles.has(filePath)) {
    return
  }

  visitedFiles.add(filePath)

  const suffix = extname(filePath)
  if (suffix === '.json' || suffix === '.yaml') {
    return
  }

  const code = await fsp.readFile(filePath, 'utf8')
  const specifiers = extractConfigSpecifiers(code)

  for (const specifier of specifiers) {
    if (isRelativeConfigSpecifier(specifier)) {
      const dependencyPath = await resolveConfigDependencyPath(
        filePath,
        specifier,
      )

      if (dependencyPath) {
        await collectConfigNativeModules(
          dependencyPath,
          nativeModules,
          visitedFiles,
        )
      }

      continue
    }

    if (!isBareModuleSpecifier(specifier)) {
      continue
    }

    for (const candidate of resolveNativeModuleCandidates(specifier)) {
      nativeModules.add(candidate)
    }
  }
}

async function resolveConfigNativeModules(filePath: string): Promise<string[]> {
  const nativeModules = new Set(BASE_NATIVE_MODULES)

  await collectConfigNativeModules(filePath, nativeModules, new Set())

  return [...nativeModules]
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
  if (EXECUTABLE_CONFIG_SUFFIXES.has(suffix)) {
    return loadConfigAsExecutable(configPath)
  }
  if (suffix === '.json') {
    return await fse.readJson(configPath)
  }
  if (suffix === '.yaml') {
    const text = await fsp.readFile(configPath, 'utf8')
    return parse(text)
  }

  throw new Error('No configuration file ! ')
}
