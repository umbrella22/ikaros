# @ikaros-cli/ikaros-platform-desktop-client

## 2.3.0

### Minor Changes

- 对齐核心静默模式能力，优化 Electron 平台预警输出处理
- 同步环境检查与 CDN 相关重构，提升平台运行稳定性
- 更新依赖并同步版本至 2.3.0

## 2.2.0

### Minor Changes

- 重构 Electron 平台为 PlatformAdapter 架构
- 删除旧的基于 BaseCompileService 的编译服务类
- 新增 ElectronDesktopPlatform 类实现 PlatformAdapter 接口
- 将 main/preload 的 Rspack 配置提取到独立的 config 文件中
- 通过 BundlerAdapter 统一管理渲染进程的构建（支持 Rspack/Vite）
- 优化开发/构建流程，支持三合一并行构建
- 提升代码可维护性和与核心平台的架构一致性

## 2.1.3

### Minor Changes

- 添加vite引擎，分离electron逻辑

### Patch Changes

- Updated dependencies
  - @ikaros-cli/ikaros@2.1.0

## 2.0.0

### Major Changes

- 初始版本：提供 `desktopClient`（Electron）平台编译与开发运行能力，作为 `@ikaros-cli/ikaros` 的可选依赖按需加载。
