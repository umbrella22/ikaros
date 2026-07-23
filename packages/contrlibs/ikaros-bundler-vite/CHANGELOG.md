# @ikaros-cli/ikaros-bundler-vite

## [3.1.0](https://github.com/umbrella22/ikaros/compare/@ikaros-cli/ikaros-bundler-vite@v3.0.0...@ikaros-cli/ikaros-bundler-vite@v3.1.0) (2026-07-20)


### Features

* update minimum release versions and add new dependencies ([9720311](https://github.com/umbrella22/ikaros/commit/9720311fc0f266b0cce8eac07193a169fceea850))
* update pnpm workspace configuration and enhance readme with new features and usage instructions ([fea959a](https://github.com/umbrella22/ikaros/commit/fea959abc3de4fb53ab05b35baaab5aad3407095))
* **vite:** 重构并添加 Vite bundler 适配器与测试 ([26f7c9c](https://github.com/umbrella22/ikaros/commit/26f7c9c0a2f9f748440ef9a3ef11bbf909ebac2f))
* **watchdog:** 添加看门狗机制支持配置文件和环境变量热重载 ([81faf3e](https://github.com/umbrella22/ikaros/commit/81faf3ecb8fcb1cfccf880b5d39d834e7a4e173c))
* 扩展 Vite 默认扩展名支持 rspack 的 '...' 展开语法，并更新相关测试 ([ad946c4](https://github.com/umbrella22/ikaros/commit/ad946c48298fabdaf5f472124b8bbd8a263c1a63))
* 新增库模式支持，为 React 和 Vue 添加示例项目 ([918bc82](https://github.com/umbrella22/ikaros/commit/918bc821a4eef24c3232a01482aec8aff997d389))
* 新增静默模式并重构警告处理 ([ba97705](https://github.com/umbrella22/ikaros/commit/ba977059d548a8a0b791023b83526bbd827c1fe2))
* 重构cli ([e27a675](https://github.com/umbrella22/ikaros/commit/e27a6759c3af3b25106a385d3f76e1f18d0e8165))

## 2.3.0

### Minor Changes

- 新增库模式配置生成支持并补充相关类型导出
- 适配核心 Watchdog 热重载流程，优化 Vite 适配器联动行为
- 对齐静默模式输出策略并补充对应测试覆盖
- 更新依赖并同步版本至 2.3.0

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
