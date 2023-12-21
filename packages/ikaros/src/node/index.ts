// 所有配置类型
export * from './user-config'

// 虽然 ./utils.ts 也有导出，但为了节省标记树摇，这里做独立导出
import { version as _version } from '../../package.json'

// 还有一个 tsup 的 dts 有点鬼畜，如果直接 export 这个值，特么竟然导出表达式到声明文件里
// 所有只能先重命名导出再 export，神坑
/** 版本号 */
export const version = _version