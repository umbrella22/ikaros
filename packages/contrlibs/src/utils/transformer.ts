import { transform, type TransformOptions } from 'oxc-transform'
import { readFile } from 'node:fs/promises'

/**
 *
 * @param path 需要解析的文件路径
 * @param options 转换选项
 * @returns {Promise<{code: string;declaration?: string;}>} 转换后的代码
 */
export async function transformCode(
  path: string,
  options?: TransformOptions,
): Promise<{
  code: string
  declaration?: string
}> {
  const filename = path
  const rawCode = await readFile(path, 'utf-8')
  const { code, declaration, errors } = transform(filename, rawCode, options)
  if (errors.length > 0) {
    throw new Error(
      'Transformation failed: ' + errors.map((e) => e.message).join(', '),
    )
  }
  return {
    code,
    declaration,
  }
}
