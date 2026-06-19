// config/config-loader.ts — 配置文件发现与加载

import { dirname, extname, isAbsolute, join, resolve } from 'node:path'

import fsp from 'node:fs/promises'
import fse from 'fs-extra'
import { createJiti } from 'jiti'
import { parseSync } from 'oxc-parser'
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
const BASE_NATIVE_MODULES = ['@rspack/core', 'typescript']

export interface ConfigDependencyDiagnostic {
  file: string
  message: string
}

export interface ConfigWatchFilesResult {
  files: string[]
  diagnostics: ConfigDependencyDiagnostic[]
}

export class ConfigLoadError extends Error {
  readonly filePath: string

  constructor(filePath: string, cause: unknown) {
    const message = cause instanceof Error ? cause.message : String(cause)
    super(`Failed to load config file ${filePath}: ${message}`, { cause })
    this.name = 'ConfigLoadError'
    this.filePath = filePath
  }
}

function wrapConfigLoadError<T>(filePath: string, loader: () => T): T {
  try {
    return loader()
  } catch (error) {
    throw new ConfigLoadError(filePath, error)
  }
}

async function wrapAsyncConfigLoadError<T>(
  filePath: string,
  loader: () => Promise<T>,
): Promise<T> {
  try {
    return await loader()
  } catch (error) {
    throw new ConfigLoadError(filePath, error)
  }
}

function createConfigLoader(nativeModules: string[]) {
  return createJiti(import.meta.url, {
    moduleCache: false,
    interopDefault: true,
    nativeModules,
    tryNative: false,
  })
}

function isConfigModuleNamespace(
  value: unknown,
): value is { default?: UserConfig } {
  if (!value || typeof value !== 'object' || !('default' in value)) {
    return false
  }

  return Object.getOwnPropertyNames(value).every(
    (key) => key === 'default' || key === '__esModule',
  )
}

function unwrapConfigModuleNamespace(value: unknown): UserConfig | undefined {
  let current = value

  for (let index = 0; index < 5; index += 1) {
    if (!isConfigModuleNamespace(current)) {
      return current as UserConfig | undefined
    }
    current = current.default
  }

  return current as UserConfig | undefined
}

async function loadConfigAsExecutable(
  filePath: string,
): Promise<UserConfig | undefined> {
  const nativeModules = await resolveConfigNativeModules(filePath)
  const configLoader = createConfigLoader(nativeModules)
  const loadedModule = wrapConfigLoadError(filePath, () => {
    return configLoader(filePath) as
      | UserConfig
      | { default?: UserConfig }
      | undefined
  })

  return unwrapConfigModuleNamespace(loadedModule)
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

function extractConfigSpecifiers(
  code: string,
  filePath: string,
  diagnostics?: ConfigDependencyDiagnostic[],
): string[] {
  const found = new Set<string>()

  const ast = parseSync(filePath, code, {
    sourceType: 'module',
    lang:
      filePath.endsWith('.ts') ||
      filePath.endsWith('.mts') ||
      filePath.endsWith('.cts')
        ? 'ts'
        : 'js',
  })

  if (ast.errors.length > 0) {
    diagnostics?.push({
      file: filePath,
      message: `config dependency parse failed: ${ast.errors[0]?.message ?? 'unknown parse error'}`,
    })
    return [...found]
  }

  const readLiteral = (node: unknown): string | undefined => {
    if (
      node &&
      typeof node === 'object' &&
      'type' in node &&
      node.type === 'Literal' &&
      'value' in node &&
      typeof node.value === 'string'
    ) {
      return node.value
    }
    return undefined
  }

  const reportDynamic = (kind: 'dynamic import' | 'require', node: unknown) => {
    const expression =
      node && typeof node === 'object' && 'start' in node && 'end' in node
        ? code.slice(Number(node.start), Number(node.end))
        : kind
    diagnostics?.push({
      file: filePath,
      message: `${kind} dependency cannot be statically resolved: ${expression}`,
    })
  }

  const visit = (node: unknown) => {
    if (!node || typeof node !== 'object') return
    const record = node as Record<string, unknown>

    switch (record.type) {
      case 'ImportDeclaration':
      case 'ExportNamedDeclaration':
      case 'ExportAllDeclaration': {
        const specifier = readLiteral(record.source)
        if (specifier) found.add(specifier)
        break
      }
      case 'ImportExpression': {
        const specifier = readLiteral(record.source)
        if (specifier) {
          found.add(specifier)
        } else {
          reportDynamic('dynamic import', record.source)
        }
        break
      }
      case 'CallExpression': {
        const callee = record.callee as Record<string, unknown> | undefined
        if (callee?.type === 'Identifier' && callee.name === 'require') {
          const args = Array.isArray(record.arguments) ? record.arguments : []
          const specifier = readLiteral(args[0])
          if (specifier) {
            found.add(specifier)
          } else {
            reportDynamic('require', args[0] ?? record)
          }
        }
        break
      }
    }

    for (const value of Object.values(record)) {
      if (!value || typeof value !== 'object') continue
      if (Array.isArray(value)) {
        for (const item of value) visit(item)
      } else {
        visit(value)
      }
    }
  }

  visit(ast.program)

  for (const item of ast.module.staticImports) {
    if (item.moduleRequest?.value) found.add(item.moduleRequest.value)
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
  diagnostics: ConfigDependencyDiagnostic[],
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
  const specifiers = extractConfigSpecifiers(code, filePath, diagnostics)

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
    await collectConfigDependencies(dependencyPath, dependencies, diagnostics)
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
  const specifiers = extractConfigSpecifiers(code, filePath)

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
  return (await resolveConfigWatchFilesWithDiagnostics({ configFile, context }))
    .files
}

export async function resolveConfigWatchFilesWithDiagnostics({
  configFile,
  context,
}: {
  configFile?: string
  context?: string
}): Promise<ConfigWatchFilesResult> {
  const configPath = await resolveConfigPath({ configFile, context })
  if (!configPath) {
    return {
      files: [],
      diagnostics: [],
    }
  }

  const dependencies = new Set<string>()
  const diagnostics: ConfigDependencyDiagnostic[] = []
  await collectConfigDependencies(configPath, dependencies, diagnostics)
  return {
    files: [...dependencies],
    diagnostics,
  }
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
    return await wrapAsyncConfigLoadError(configPath, () =>
      fse.readJson(configPath),
    )
  }
  if (suffix === '.yaml') {
    return await wrapAsyncConfigLoadError(configPath, async () => {
      const text = await fsp.readFile(configPath, 'utf8')
      return parse(text)
    })
  }

  throw new Error('No configuration file ! ')
}
