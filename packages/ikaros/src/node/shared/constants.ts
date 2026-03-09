// shared/constants.ts — 常量

import { join } from 'path'
import { createRequire } from 'node:module'
import { fileURLToPath, URL } from 'node:url'

export const extensions = ['...', '.mjs', '.jsx', '.ts', '.tsx']

/**
 * cli目录
 */
export const CLI_PATH = fileURLToPath(new URL('../', import.meta.url))

export const resolveCliPath: NodeJS.Require = createRequire(CLI_PATH)

/**
 * 基于cli的绝对定位
 * @param ...paths 子路径
 */
export const resolveCLI = (...paths: string[]) => join(CLI_PATH, ...paths)

// ─── 目录 & 文件名 ──────────────────────────────────────────────────────────

export const DEFAULT_OUT_DIR = 'dist'
export const DEFAULT_PUBLIC_DIR = 'public'
export const DEFAULT_ENTRY_PATH = 'src/index'
export const DEFAULT_HTML_TEMPLATE = 'index.html'
export const CONFIG_FILE_NAME = 'ikaros.config'
export const CONFIG_FILE_SUFFIXES = ['ts', 'mjs', 'json', 'yaml'] as const

// ─── 服务器 ──────────────────────────────────────────────────────────────────

export const DEFAULT_PORT = 8080
export const DEFAULT_BASE_PATH = '/'

// ─── 产物路径模板 ────────────────────────────────────────────────────────────

export const ASSET_PATHS = {
  js: 'assets/js/[contenthash:8].js',
  jsChunk: 'assets/js/[contenthash:8].chunk.js',
  css: 'assets/css/[contenthash:8].css',
  cssChunk: 'assets/css/[contenthash:8].chunk.css',
  cssExtract: 'assets/css/[contenthash].css',
  img: 'assets/img/[contenthash][ext]',
  media: 'assets/media/[contenthash][ext]',
  fonts: 'assets/fonts/[contenthash][ext]',
} as const

// ─── 浏览器兼容目标 ──────────────────────────────────────────────────────────

export const BROWSERSLIST = {
  mobile: ['defaults', 'IOS >= 16', 'Chrome >= 80'],
  pc: ['>0.2%', 'Chrome >= 90', 'Safari >= 16', 'last 2 versions', 'not dead'],
} as const

// ─── Electron ────────────────────────────────────────────────────────────────

export const ELECTRON_DEFAULT_OUTPUT = 'dist/electron/renderer'
export const ELECTRON_RENDERER_SUBDIR = 'renderer'
