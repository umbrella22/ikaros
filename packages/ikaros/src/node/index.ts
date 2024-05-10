// 所有配置类型
export * from './user-config'

// 虽然 ./utils.ts 也有导出，但为了节省标记树摇，这里做独立导出
import { version as _version } from '../../package.json'

// 重命名导出
/** 版本号 */
export const version = _version