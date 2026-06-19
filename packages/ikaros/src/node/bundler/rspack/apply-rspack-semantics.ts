import type { Configuration, Plugin, RuleSetRule } from '@rspack/core'

import type { PluginManager } from '../../core/plugin-manager'
import {
  createRspackSemanticRegistry,
  type RspackPluginValue,
} from './semantic-registry'

export async function applyRspackSemanticHooks<TConfig>(
  config: TConfig,
  pluginManager: PluginManager,
): Promise<TConfig> {
  if (Array.isArray(config)) {
    const configs = []
    for (const item of config) {
      configs.push(await applyRspackSemanticHooks(item, pluginManager))
    }
    return configs as TConfig
  }

  const rspackConfig = config as Configuration
  const rules = createRspackSemanticRegistry<RuleSetRule>(
    'rule',
    (rspackConfig.module?.rules ?? []).map((rule, index) => ({
      id: inferRspackRuleId(rule as RuleSetRule, index),
      value: rule as RuleSetRule,
    })),
  )
  const plugins = createRspackSemanticRegistry<RspackPluginValue>(
    'plugin',
    (rspackConfig.plugins ?? []).map((plugin, index) => ({
      id: inferRspackPluginId(plugin, index),
      value: plugin,
    })),
  )

  await pluginManager.applyRspackRules(rules)
  await pluginManager.applyRspackPlugins(plugins)
  const nextRules = rules.values()
  const nextPlugins = flattenRspackPlugins(plugins.values())
  const nextConfig: Configuration = { ...rspackConfig }

  if (rspackConfig.module || nextRules.length > 0) {
    nextConfig.module = {
      ...rspackConfig.module,
      rules: nextRules,
    }
  }

  if (rspackConfig.plugins || nextPlugins.length > 0) {
    nextConfig.plugins = nextPlugins
  }

  return nextConfig as TConfig
}

function flattenRspackPlugins(values: RspackPluginValue[]): Plugin[] {
  return values.flatMap((plugin) => {
    return Array.isArray(plugin) ? plugin : [plugin]
  })
}

function inferRspackRuleId(rule: RuleSetRule, index: number): string {
  const test = rule.test instanceof RegExp ? rule.test.source : ''
  const loader = typeof rule.loader === 'string' ? rule.loader : ''

  if (loader === 'builtin:swc-loader' && test.includes('tsx')) {
    return 'script:tsx'
  }
  if (loader === 'builtin:swc-loader' && test.includes('jsx')) {
    return 'script:jsx'
  }
  if (loader === 'builtin:swc-loader' && test.includes('ts')) {
    return 'script:ts'
  }
  if (loader === 'builtin:swc-loader' && test.includes('js')) {
    return 'script:js'
  }
  if (test.includes('png') || test.includes('svg')) {
    return 'asset:image'
  }
  if (test.includes('mp4') || test.includes('mp3')) {
    return 'asset:media'
  }
  if (test.includes('woff')) {
    return 'asset:font'
  }

  const styleMatch = test.match(/\\\.([a-z0-9]+)\$/i)
  if (styleMatch?.[1]) {
    return `style:${styleMatch[1]}`
  }

  return `config:rule:${index}`
}

function inferRspackPluginId(plugin: unknown, index: number): string {
  const name = readRspackPluginName(plugin)

  if (name.includes('Html')) return `html:${index}`
  if (name.includes('Copy')) return 'copy:public'
  if (name.includes('Define')) return 'define:env'
  if (name.includes('StatsPlugin')) return 'stats'
  if (name.includes('CssExtract')) return 'css-extract'
  if (name.includes('SourceMap')) return 'sourcemap'
  if (name.includes('Rsdoctor')) return 'doctor'
  if (name.includes('Compression')) return 'gzip'
  if (name.includes('CdnPlugin')) return 'cdn'
  if (name.includes('ModuleFederation')) return 'module-federation'
  if (name.includes('CircularDependency')) return 'dependency-cycle'

  return `config:plugin:${index}`
}

function readRspackPluginName(plugin: unknown): string {
  if (
    plugin &&
    typeof plugin === 'object' &&
    'constructor' in plugin &&
    plugin.constructor &&
    typeof plugin.constructor === 'function'
  ) {
    return plugin.constructor.name
  }

  if (
    plugin &&
    typeof plugin === 'object' &&
    'name' in plugin &&
    typeof plugin.name === 'string'
  ) {
    return plugin.name
  }

  return ''
}
