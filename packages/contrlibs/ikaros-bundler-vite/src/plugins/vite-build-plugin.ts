import type { Plugin } from 'vite'
import { gzipSync } from 'node:zlib'

export type IkarosViteBuildPluginOptions = {
  gzip?: boolean
  outReport?: boolean
  dependencyCycleCheck?: boolean
}

type BundleReportItem = {
  fileName: string
  type: 'chunk' | 'asset'
  bytes: number
  gzipBytes?: number
}

type BundleReport = {
  createdAt: string
  items: BundleReportItem[]
  totals: {
    bytes: number
    gzipBytes?: number
  }
  cycles?: string[][]
}

const shouldGzipFile = (fileName: string): boolean => {
  return /\.(m?js|css|html|json|svg|txt|wasm)$/i.test(fileName)
}

const toBytes = (input: string | Uint8Array): number => {
  return typeof input === 'string' ? Buffer.byteLength(input) : input.byteLength
}

const toUint8Array = (input: string | Uint8Array): Uint8Array => {
  return typeof input === 'string' ? Buffer.from(input) : input
}

const detectCycles = (ctx: {
  getModuleIds: () => IterableIterator<string>
  getModuleInfo: (id: string) => {
    id: string
    importedIds: readonly string[]
  } | null
}): string[][] => {
  const graph = new Map<string, string[]>()

  for (const id of ctx.getModuleIds()) {
    if (!id) continue
    if (id.includes('node_modules')) continue

    const info = ctx.getModuleInfo(id)
    if (!info) continue

    const deps = [...info.importedIds].filter(
      (dep) => dep && !dep.includes('node_modules'),
    )
    graph.set(id, deps)
  }

  const visited = new Set<string>()
  const stack = new Set<string>()
  const path: string[] = []
  const cycles: string[][] = []

  const dfs = (node: string) => {
    visited.add(node)
    stack.add(node)
    path.push(node)

    const deps = graph.get(node) ?? []
    for (const dep of deps) {
      if (!graph.has(dep)) continue

      if (!visited.has(dep)) {
        dfs(dep)
        continue
      }

      if (stack.has(dep)) {
        const startIndex = path.indexOf(dep)
        if (startIndex !== -1) {
          const cycle = path.slice(startIndex).concat(dep)
          const signature = cycle.join(' -> ')
          if (!cycles.some((c) => c.join(' -> ') === signature)) {
            cycles.push(cycle)
          }
        }
      }
    }

    path.pop()
    stack.delete(node)
  }

  for (const node of graph.keys()) {
    if (!visited.has(node)) dfs(node)
  }

  return cycles
}

export const createIkarosViteBuildPlugin = (
  opts: IkarosViteBuildPluginOptions,
): Plugin => {
  const { gzip, outReport, dependencyCycleCheck } = opts

  return {
    name: 'ikaros:vite-build',
    apply: 'build',

    generateBundle(_outputOptions, bundle) {
      const reportItems: BundleReportItem[] = []
      let totalBytes = 0
      let totalGzipBytes = 0

      for (const item of Object.values(bundle)) {
        if (item.type === 'chunk') {
          const bytes = Buffer.byteLength(item.code)
          const reportItem: BundleReportItem = {
            fileName: item.fileName,
            type: 'chunk',
            bytes,
          }

          totalBytes += bytes

          if (gzip && shouldGzipFile(item.fileName)) {
            const gz = gzipSync(toUint8Array(item.code))
            reportItem.gzipBytes = gz.byteLength
            totalGzipBytes += gz.byteLength

            this.emitFile({
              type: 'asset',
              fileName: `${item.fileName}.gz`,
              source: gz,
            })
          }

          reportItems.push(reportItem)
          continue
        }

        const source = item.source ?? ''
        const srcBytes =
          typeof source === 'string' || source instanceof Uint8Array
            ? toBytes(source)
            : Buffer.byteLength(String(source))

        const reportItem: BundleReportItem = {
          fileName: item.fileName,
          type: 'asset',
          bytes: srcBytes,
        }

        totalBytes += srcBytes

        if (gzip && shouldGzipFile(item.fileName)) {
          const normalized =
            typeof source === 'string' || source instanceof Uint8Array
              ? toUint8Array(source)
              : Buffer.from(String(source))

          const gz = gzipSync(normalized)
          reportItem.gzipBytes = gz.byteLength
          totalGzipBytes += gz.byteLength

          this.emitFile({
            type: 'asset',
            fileName: `${item.fileName}.gz`,
            source: gz,
          })
        }

        reportItems.push(reportItem)
      }

      const cycles = dependencyCycleCheck
        ? detectCycles({
            getModuleIds: this.getModuleIds.bind(this),
            getModuleInfo: this.getModuleInfo.bind(this),
          })
        : []

      if (dependencyCycleCheck && cycles.length > 0) {
        const preview = cycles.slice(0, 5)
        this.warn(
          `Detected circular dependencies (showing ${preview.length}/${cycles.length}):\n` +
            preview.map((c) => `- ${c.join(' -> ')}`).join('\n'),
        )
      }

      if (outReport) {
        const report: BundleReport = {
          createdAt: new Date().toISOString(),
          items: reportItems.sort((a, b) => b.bytes - a.bytes),
          totals: {
            bytes: totalBytes,
            gzipBytes: gzip ? totalGzipBytes : undefined,
          },
          cycles:
            dependencyCycleCheck && cycles.length > 0 ? cycles : undefined,
        }

        this.emitFile({
          type: 'asset',
          fileName: 'ikaros-report.json',
          source: JSON.stringify(report, null, 2),
        })
      }
    },
  }
}
