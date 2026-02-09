// platform/desktop/index.ts — Desktop 平台目录入口
//
// Desktop 平台的实际实现在外部可选依赖 @ikaros-cli/ikaros-platform-desktop-client 中。
// 加载逻辑通过 platform-factory.ts 中的 createDesktopPlatformProxy 处理。
//
// 此文件作为目录入口，导出 desktop 平台相关的公共类型与约定。

/**
 * Desktop 平台包需要导出的命名约定：
 *
 * ```typescript
 * // @ikaros-cli/ikaros-platform-desktop-client 的入口文件应导出：
 * export const ElectronDesktopPlatform: PlatformAdapter = { ... }
 * ```
 */
export const DESKTOP_PLATFORM_PACKAGE =
  '@ikaros-cli/ikaros-platform-desktop-client' as const
