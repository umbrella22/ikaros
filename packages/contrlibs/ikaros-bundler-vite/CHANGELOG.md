# @ikaros-cli/ikaros-bundler-vite

## 2.2.0

### Minor Changes

- 新增 ViteBundlerAdapter 实现主包 BundlerAdapter 接口，提供统一的配置创建与构建执行
- 新增结构化错误类 BundlerError 以对齐主包错误收口策略
- 重构配置生成逻辑，将 createWebViteConfig 拆分为模块化的 create-vite-config 与 normalize 工具
- 将循环依赖检测函数 detectCycles 导出为公共 API 并添加完整测试
- 更新类型定义以与主包 BundlerAdapter 接口完全对齐
- 添加 Vitest 测试配置与覆盖核心功能的单元测试
- 升级版本至 2.2.0 并添加 vitest 开发依赖

## 2.1.0

### Minor Changes

- 添加vite引擎，分离electron逻辑

## 2.0.0

### Major Changes

- 初始版本：为 `@ikaros-cli/ikaros` 提供 Vite bundler 的可选适配能力（Node.js >= 22）。
