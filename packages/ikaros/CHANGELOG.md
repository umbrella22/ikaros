# @ikaros-cli/ikaros

## 2.3.0

### Minor Changes

- 新增库模式编译支持，扩展 Rspack 库构建配置与配置项校验
- 新增静默模式并重构警告处理流程，统一预警与构建输出行为
- 新增 Watchdog 机制，支持配置文件与环境变量变更热重载
- 重构环境变量检查与 CDN 插件逻辑，精简 Node.js 版本检查流程
- 修复多处 Rspack/Vite 适配器与编译管线稳定性问题
- 更新依赖并同步版本至 2.3.0

## 2.2.0

### Minor Changes

- 新增平台适配器接口，支持 web 和 desktopClient 平台
- 新增打包器适配器接口，支持 rspack 和 vite 打包器
- 实现统一编译管线，将原有分散的编译逻辑整合为线性流程
- 重构配置文件加载、环境变量加载等工具函数到独立模块
- 更新依赖版本并添加单元测试

## 2.1.0

### Minor Changes

- vite编译从核心包剥离为可选依赖。

## 2.0.0

### Major Changes (2.0.0)

- 完善cli配置文件初始化，更换已过期依赖。
- desktopClient（Electron）编译能力从核心包剥离为可选依赖：启用 `--platform desktopClient` 时需在项目中安装 `@ikaros-cli/ikaros-platform-desktop-client`。

## 1.3.0

### Minor Changes (1.3.0)

- 更新依赖

## 1.2.0

### Minor Changes (1.2.0)

- 更新依赖，现在所有包仅支持esm模式

## 1.1.3

### Patch Changes

- 更新依赖，优化配置初始化速度

## 1.1.1

- 修复部分类型问题
- 环境变量没有正确导入的问题

## 1.0.0

### Major Changes (1.0.0)

- ikaros-cli正式发布
