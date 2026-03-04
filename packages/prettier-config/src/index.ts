export const trailingComma = 'all'
export const semi = false
export const singleQuote = true
export const printWidth = 80
export const endOfLine = 'lf'
export const htmlWhitespaceSensitivity = 'ignore'

/**
 * 完整的 Prettier 配置对象
 *
 * 提供 default export 以支持 `export { default } from '@ikaros-cli/prettier-config'` 用法
 */
const config = {
  trailingComma,
  semi,
  singleQuote,
  printWidth,
  endOfLine,
  htmlWhitespaceSensitivity,
} as const

export default config
