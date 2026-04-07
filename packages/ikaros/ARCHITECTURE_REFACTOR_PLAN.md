# Ikaros Architecture Refactor Plan

## 1. Background

`@ikaros-cli/ikaros` 目前已经具备基础的编译管线、平台适配器、bundler 适配器，以及 dev watchdog 能力，但整体仍偏"可运行的编排层"，距离一个稳定、可扩展、可调试的框架内核还有明显差距。

当前最核心的问题不是某一个功能点缺失，而是几类职责还没有被清晰分层：

- 用户配置、默认值、派生配置、最终 bundler 配置之间缺少规范化的中间层。
- 平台抽象仍然偏粗，很多逻辑实际上已经在向"多环境编排"靠近。
- dev/build/watch 的生命周期仍偏过程式，资源清理和状态管理还没有完全实例化。
- 缺少框架级的扩展点，后续如果要支持更多约定能力，只能继续往 pipeline 里堆逻辑。
- 配置的 bundler 边界虽然已经初步建立，但命名和迁移策略仍不够清晰。

## 2. Design Decisions

### 2.1 设计原则

这次改造遵循以下原则：

1. 不统一 `vite` 和 `rspack` 的原生插件与 loader 体系。
2. 框架插件系统对齐 rsbuild 插件协议（`{ name, setup(api) }` 签名），不发明新的插件抽象，便于复用 rsbuild 社区插件。
3. bundler 特有配置必须显式命名空间隔离，避免误用。
4. 所有编译行为都围绕"实例"和"环境"建模，而不是全局过程函数。实例化是所有后续改造的载体，应优先完成。
5. 规范化配置必须成为唯一的内部消费入口，所有字段在 normalize 后必须为非可选。
6. 所有新能力都需要提供 inspect / diagnostics 能力，避免成为黑盒。
7. `CreateConfigParams` 等内部接口只包含 bundler-agnostic 信息，bundler-specific 派生在各自 adapter 内部完成。

### 2.2 非目标

以下内容不在本次改造范围内：

- 不把 `rspack` 插件转换成 `vite` 插件，反之亦然。
- 不试图做 bundler 无差别兼容层。
- 不在这一轮接入 webpack。
- 不在这一轮做 SSR / RSC 的完整支持，只为后续铺路。

## 3. Target Architecture

目标架构分为六层：

1. `Instance Creation`
   - `createIkaros(options)` 创建实例，持有所有运行时状态
   - 对齐 rsbuild 的 `createRsbuild()` 模式
2. `Raw User Config`
   - 直接来自 `ikaros.config.*`
   - 保留用户书写形态
3. `Plugin Registration & Config Mutation`
   - 插件使用 rsbuild 兼容的 `{ name, setup(api) }` 协议
   - 通过 hooks 修改原始配置或派生上下文
4. `Normalized Config`
   - 合并默认值、兼容字段、平台默认值后的稳定结构
   - 所有字段非可选，吸收 `resolve-web-preconfig.ts` 中的 port/browserslist/pages 等派生逻辑
5. `Bundler Config Generation`
   - 按平台/环境生成 `rspack` / `vite` 配置
6. `Runtime Instance Lifecycle`
   - 统一管理 dev/build/watch/close/restart/inspect

建议新增的目录结构：

```text
packages/ikaros/src/node/
  core/
    create-ikaros.ts
    ikaros-instance.ts
    hooks.ts
    plugin-api.ts
    plugin-manager.ts
    instance-context.ts
  config/
    config-loader.ts
    config-schema.ts
    merge-config.ts
    normalize-config.ts
    config-compat.ts
    env-loader.ts
  inspect/
    inspect-config.ts
    serialize-config.ts
  watch/
    watch-service.ts
```

说明：

- 现有 `compile/`, `platform/`, `watchdog/` 不要求一步删掉。
- 初期允许新旧结构并存，先把逻辑迁走，再收敛旧入口。
- `environment/` 目录按需创建，在 Milestone 6 启动时再添加。

## 4. Milestones

整个改造分为 6 个阶段，推荐按以下顺序推进：

M0 → M1（Instance API） → M2（Config Namespace） → M3（Normalized Config） → M4（Plugin System） → M5（Inspect） → M6（Environment，按需推迟）

核心原则：**先有实例，再有配置管线，最后才开放扩展点**。对齐 rsbuild 的 `createRsbuild()` → `initRsbuildConfig()` → `initPlugins()` → `generateRspackConfig()` 流程。

---

## Milestone 0: Baseline and Safety Net

### Goal

为后续改造建立稳定测试基线和兼容约束，避免架构调整时出现"通过重构引入行为回归"。

### Implementation Steps

1. 盘点当前外部 API
   - 梳理 [src/node/index.ts](/Users/ikaros/learn/ikaros/packages/ikaros/src/node/index.ts) 的导出项。
   - 标记哪些是对外承诺，哪些只是内部拼装产物。
2. 冻结现有 CLI 行为
   - 记录 `dev/build` 命令的输入输出行为。
   - 记录 `platform`, `bundler`, `mode`, `configFile` 的行为矩阵。
3. 补充回归测试快照
   - 配置加载
   - env 加载
   - watchdog 重启
   - rspack/vite adapter 基础行为
4. 增加测试覆盖
   - **单元测试**重点覆盖 config normalize、compat shim、plugin hook 执行顺序
   - **集成测试**用 `createConfig()` 输出的配置快照做断言，不真正启动 dev server
   - **Smoke test** 只在 CI 上跑，本地开发用 example 项目手动验证
   - 覆盖矩阵：`web + rspack + dev/build`、`web + vite + dev/build`

### Files

- [src/node/index.ts](/Users/ikaros/learn/ikaros/packages/ikaros/src/node/index.ts)
- [src/node/compile/index.ts](/Users/ikaros/learn/ikaros/packages/ikaros/src/node/compile/index.ts)
- `packages/ikaros/tests/**/*`

### Acceptance Criteria

- 现有导出 API 清单有文档。
- 全量测试在改造开始前是绿色。
- 有覆盖 config normalize 和 config snapshot 的集成测试入口。
- Smoke tests 在 CI 环境可运行。

---

## Milestone 1: Instance API and Scoped Runtime State

### Goal

把当前过程式执行入口改造成实例 API，清理全局状态。实例化是所有后续改造的载体——插件注册在实例上，config pipeline 有明确的执行宿主，watchdog 实例级管理。

对齐 rsbuild 的 `createRsbuild()` 模式：

```ts
const rsbuild = await createRsbuild({ config })
await rsbuild.build()
const server = await rsbuild.startDevServer()
await rsbuild.inspectConfig()
```

### Design

新增实例 API：

```ts
const ikaros = await createIkaros(options)

await ikaros.dev()
await ikaros.build()
await ikaros.inspectConfig()
await ikaros.close()
```

### Problems to Solve

- 当前 cleanup registry 是全局数组，不适合多实例与嵌套调用。
- 当前 watch/build/dev 生命周期分散在函数间，不利于封装和调试。

### Implementation Steps

1. 新建 `core/create-ikaros.ts`
2. 新建 `core/ikaros-instance.ts`
3. 将 cleanup registry 改为实例级
   - registry 由 instance 持有
   - watch/dev/build 都注册到实例中
4. 将 [compile-pipeline.ts](/Users/ikaros/learn/ikaros/packages/ikaros/src/node/compile/compile-pipeline.ts) 改为 instance 方法内部调用
5. CLI 改为：
   - `createIkaros()`
   - `ikaros.dev()` / `ikaros.build()`
6. 保留旧导出
   - `runCompile`
   - `runCompileWithWatchdog`
   - 作为兼容封装，内部委托给 instance

### Files

- 新增 `src/node/core/create-ikaros.ts`
- 新增 `src/node/core/ikaros-instance.ts`
- 重构 [compile-pipeline.ts](/Users/ikaros/learn/ikaros/packages/ikaros/src/node/compile/compile-pipeline.ts)
- 重构 [watchdog.ts](/Users/ikaros/learn/ikaros/packages/ikaros/src/node/watchdog/watchdog.ts)
- 重构 [cleanup-registry.ts](/Users/ikaros/learn/ikaros/packages/ikaros/src/node/watchdog/cleanup-registry.ts)

### Acceptance Criteria

- 不再依赖全局 cleanup registry 维护运行时状态。
- 支持明确的 `close()`。
- CLI 与 JS API 共享同一套核心实现。

---

## Milestone 2: Config Namespacing and Compatibility Layer

### Goal

把 bundler 特有配置彻底显式化，避免用户误把 rspack 的 `plugins/loaders` 当成 vite 能用的字段。

### Design

新增配置结构（对齐 rsbuild 风格，框架插件放顶层 `plugins` 而非嵌套在 `framework` 中）：

```ts
type UserConfig = {
  bundler?: 'rspack' | 'vite';
  // 框架级插件，顶层放置（对齐 rsbuild 的 config.plugins）
  plugins?: IkarosPlugin[];
  rspack?: {
    plugins?: Plugin | Plugin[];
    loaders?: Loader[];
    experiments?: RspackExperiments;
    moduleFederation?: ModuleFederationOptions | ModuleFederationOptions[];
    cdnOptions?: CdnPluginOptions;
    css?: { ... };
  };
  vite?: {
    plugins?: unknown;
    // 未来再扩
  };
};
```

说明：

- rsbuild 的结构是 `{ plugins: [rsbuildPlugin()], tools: { rspack: ... } }`，ikaros 采用 `{ plugins: [ikarosPlugin()], rspack: { ... }, vite: { ... } }` 的扁平命名空间。
- 不嵌套 `framework.plugins`，减少配置层级。

兼容策略：

- 旧的顶层 `plugins/loaders/experiments/moduleFederation/cdnOptions/css` 先保留一到两个版本。
- 读取时迁移到 `rspack.*`。
- 在 dev/build 时打印一次 deprecation warning。
- 新文档只展示 `rspack.*` / `vite.*`。

### Implementation Steps

1. 在 [user-config.ts](/Users/ikaros/learn/ikaros/packages/ikaros/src/node/config/user-config.ts) 新增 `plugins`（顶层）与 `rspack` 命名空间类型。
2. 在 [config-schema.ts](/Users/ikaros/learn/ikaros/packages/ikaros/src/node/config/config-schema.ts) 中新增新结构的 schema。
3. 新建 `config-compat.ts`
   - 输入原始配置
   - 迁移旧字段到新字段
   - 生成 deprecation warnings
4. 改造 rspack 配置消费方
   - [create-web-rspack-config.ts](/Users/ikaros/learn/ikaros/packages/ikaros/src/node/compile/web/create-web-rspack-config.ts)
   - [create-library-rspack-config.ts](/Users/ikaros/learn/ikaros/packages/ikaros/src/node/bundler/rspack/create-library-rspack-config.ts)
   - 所有读取 `userConfig.plugins/loaders/...` 的位置改读 `userConfig.rspack.*`
5. 保持 vite 路径只读 `userConfig.vite`
6. 给旧字段增加测试
   - 旧字段仍然生效
   - 会产生警告
   - 新字段优先于旧字段

### Acceptance Criteria

- 用户在 `bundler='vite'` 下不再看到顶层 rspack 字段。
- `rspack` 和 `vite` 配置边界通过类型和 schema 双重约束。
- 旧配置可以继续跑，但有明确迁移提示。

---

## Milestone 3: Normalized Config Pipeline

### Goal

建立统一的 `normalized config`，让内部代码不再直接消费"用户原始配置"。

对齐 rsbuild 的三阶段配置模型：

1. `getRsbuildConfig('original')` → 原始用户配置
2. `getRsbuildConfig('current')` → 经过 `modifyRsbuildConfig` hook 修改后的配置
3. `getNormalizedConfig()` → 填充所有默认值后的完整配置

### Design

新增三类配置对象：

1. `RawUserConfig`
   - loader 返回的直接结果
2. `ResolvedUserConfig`
   - 经过兼容迁移与 plugin 修改
3. `NormalizedConfig`
   - 默认值、派生值全部填充完成
   - **所有字段非可选**——这是 normalize 的核心价值
   - 吸收 `resolve-web-preconfig.ts` 中的派生逻辑：`port`、`browserslist`、`pages`、`isVue`、`isReact` 等

### Implementation Steps

1. 新建 `merge-config.ts`
   - 统一做配置深合并（参考 rsbuild 的 `mergeRsbuildConfig`）
2. 新建 `normalize-config.ts`
   - 负责填充默认值
   - 计算 `base`, `target`, `pages`, `browserslist`, `server`, `port` 等
   - 将 `isVue`、`isReact` 等依赖探测纳入 normalize 阶段
3. 把 [resolve-web-preconfig.ts](/Users/ikaros/learn/ikaros/packages/ikaros/src/node/compile/web/resolve-web-preconfig.ts) 的职责下沉到 normalize 阶段
   - 端口、target、pages、依赖探测等不再散落在 platform 层
   - `CreateConfigParams` 改为只包含 bundler-agnostic 信息，bundler-specific 派生在 adapter 内部完成
4. 让 compile pipeline 改成只接收 normalized config
5. 输出统一类型
   - `NormalizedConfig`（框架级，所有字段必填）
   - `NormalizedRspackConfig`（rspack 命名空间部分）
   - `NormalizedViteConfig`（vite 命名空间部分）
6. 增加 inspect-friendly 数据结构
   - 保留 config 来源、默认值来源、compat 转换记录

### Files

- 新增 `src/node/config/merge-config.ts`
- 新增 `src/node/config/normalize-config.ts`
- 重构 [compile-context.ts](/Users/ikaros/learn/ikaros/packages/ikaros/src/node/compile/compile-context.ts)
- 重构 [resolve-web-preconfig.ts](/Users/ikaros/learn/ikaros/packages/ikaros/src/node/compile/web/resolve-web-preconfig.ts)
- 重构 [bundler/types.ts](/Users/ikaros/learn/ikaros/packages/ikaros/src/node/bundler/types.ts)（精简 `CreateConfigParams`）

### Acceptance Criteria

- 内部不再直接读取未规范化的 `userConfig`。
- 默认值逻辑集中在 normalize 阶段。
- `NormalizedConfig` 所有字段非可选。
- inspect 可以直接输出 normalized config。

---

## Milestone 4: Plugin System

### Goal

建立框架级插件系统，对齐 rsbuild 插件协议，但明确不替代 bundler 原生插件。

### Design Philosophy

直接复用 rsbuild 插件协议的 subset：

- rsbuild 的插件接口 `{ name, setup(api) }` 本身是框架无关的。
- ikaros 不需要实现完整的 rsbuild plugin manager，但使用相同签名。
- 内部用一个简化版 hook container（类似 tapable 或 rsbuild 的 `AsyncHook`）来驱动。
- 好处：**用户以后可以直接把 rsbuild 社区的兼容插件拿来用**，不被锁在 ikaros 生态里。

### Scope

插件只能处理这些事情：

- 修改框架配置
- 追加 watch files
- 注入约定式 pages / aliases / env
- 注册 lifecycle hooks
- 按 bundler 类型分别修改最终 config

不处理这些事情：

- 统一 vite/rspack 原生 plugin API
- 统一 loader 语义

### API Shape

插件签名（对齐 rsbuild `RsbuildPlugin`）：

```ts
export type IkarosPlugin = {
  name: string
  setup(api: IkarosPluginAPI): void | Promise<void>
}
```

建议首批 hooks（对齐 rsbuild 命名规范）：

- `modifyIkarosConfig` — 修改用户配置（对齐 `modifyRsbuildConfig`）
- `modifyNormalizedConfig` — 修改规范化后的配置
- `modifyRspackConfig` — 修改最终 rspack 配置（对齐 rsbuild 同名 hook）
- `modifyViteConfig` — 修改最终 vite 配置
- `onBeforeCreateCompiler` — bundler config 生成前（对齐 rsbuild 同名 hook）
- `onBeforeBuild` — 构建前
- `onAfterBuild` — 构建后
- `onBeforeStartDevServer` — dev server 启动前（对齐 rsbuild 同名 hook）
- `onAfterStartDevServer` — dev server 启动后（对齐 rsbuild 同名 hook）
- `onCloseDevServer` — dev server 关闭
- `onCloseBuild` — 构建关闭

### Implementation Steps

1. 新建 `core/hooks.ts`
   - 定义 hook 容器与执行顺序
   - 参考 rsbuild 的 `AsyncHook` 实现（支持 `tap` / `callChain` / `callBatch`）
2. 新建 `core/plugin-api.ts`
   - 定义 `IkarosPluginAPI`
   - 提供 `context`、`getIkarosConfig`、`getNormalizedConfig` 等读取方法
3. 新建 `core/plugin-manager.ts`
   - 负责注册、排序与执行插件
   - 支持 `addPlugins` / `removePlugins` / `isPluginExists`
4. 在 config 顶层加入 `plugins: IkarosPlugin[]`
5. pipeline 改造
   - config load 后执行 `modifyIkarosConfig`
   - normalize 后执行 `modifyNormalizedConfig`
   - 生成 bundler config 前调用 `modifyRspackConfig` / `modifyViteConfig`
   - dev/build lifecycle 中触发运行时 hooks
6. 把 `create-web-rspack-config.ts` 中的关注点逐步抽成内置插件
   - 优先拆分：CSS 处理、代码分割、HTML 生成
   - 用户可通过 `removePlugins` 覆盖默认行为
   - 不急着一步到位全拆，先拆 2~3 个作为验证
7. 文档明确边界
   - "ikaros plugin 和 bundler plugin 的区别"
   - 标注哪些 hooks 与 rsbuild 兼容

### Files

- 新增 `src/node/core/hooks.ts`
- 新增 `src/node/core/plugin-api.ts`
- 新增 `src/node/core/plugin-manager.ts`
- 改造 [compile-pipeline.ts](/Users/ikaros/learn/ikaros/packages/ikaros/src/node/compile/compile-pipeline.ts)
- 改造 bundler adapter 相关入口
- 逐步拆分 [create-web-rspack-config.ts](/Users/ikaros/learn/ikaros/packages/ikaros/src/node/compile/web/create-web-rspack-config.ts) 为内置插件

### Acceptance Criteria

- 可以注册 ikaros 插件，不影响用户继续直接使用 `rspack.plugins` / `vite.plugins`。
- 插件签名与 rsbuild 兼容（`{ name, setup(api) }`）。
- 框架插件可以分 bundler 修改最终配置，但不会冒充 bundler 原生插件。
- 插件执行顺序稳定可测。
- 至少 2 个关注点已从 `create-web-rspack-config.ts` 拆为内置插件。

---

## Milestone 5: Inspect and Diagnostics

### Goal

让配置、环境、watch、restart、plugin 顺序都可被定位和导出。对齐 rsbuild 的 `inspectConfig` 能力。

### Implementation Steps

1. 新增 `inspectConfig` 方法（挂载在 ikaros 实例上）
   - 原始配置
   - 兼容转换结果
   - normalized config
   - 最终 bundler config
   - 参考 rsbuild 的 `inspectConfig` 实现，支持 `writeToDisk` 选项
2. 新增 inspect CLI
   - `ikaros inspect`
3. 给 watchdog 增加重启原因分类
   - config changed
   - env changed
   - plugin watch files changed
4. 给 plugin system 增加调试输出
   - 注册顺序
   - 执行顺序
   - 修改了哪些配置段
5. 给 env loader 增加来源信息
   - 每个 key 来自哪个 env 文件
6. 给端口解析、依赖探测、framework 判定增加 explainable logs

### Acceptance Criteria

- 用户可以导出最终配置。
- 遇到"配置没生效"时能快速定位。
- watch 重启和 env 覆盖关系可追踪。

---

## Milestone 6: Environment-Oriented Architecture（按需推迟）

### Goal

从"platform 驱动"升级为"environment 驱动"，为 desktop / SSR / 多目标编译铺路。

> **注意**：此 milestone 优先级最低，建议在真正需要 SSR 或更复杂的多目标编译时再启动。当前 `web` + `desktopClient` 两个平台的 platform adapter 模型已经够用，desktop 的编排逻辑在 `ikaros-platform-desktop-client` 包里已存在。硬拆成 environment 模型收益有限但改动量大。

### Design

新增环境模型：

```ts
type EnvironmentKind = 'web' | 'renderer' | 'main' | 'preload'

type EnvironmentConfig = {
  name: string
  kind: EnvironmentKind
  bundler: 'rspack' | 'vite'
  target: 'browser' | 'node' | 'electron-renderer' | 'electron-main'
}
```

兼容策略：

- 现有 CLI `--platform web|desktopClient` 保留。
- 内部先映射为环境集合。
- `web` -> `['web']`
- `desktopClient` -> `['renderer', 'main', 'preload']`

### Implementation Steps

1. 新建 `environment/environment-types.ts`
2. 新建 `environment/environment-resolver.ts`
3. 把 [platform/types.ts](/Users/ikaros/learn/ikaros/packages/ikaros/src/node/platform/types.ts) 的大部分"平台预配置"转换为"环境描述"
4. 让 compile pipeline 由"单平台单配置"改为"环境数组编排"
5. web 环境优先迁移
6. desktop 平台适配器改造成环境提供者，而不是直接承担全部编排
7. 更新 `BuildStatus`
   - 明确按环境上报

### Acceptance Criteria

- `web` 场景行为不变。
- desktop 内部不再是黑盒代理，而是显式的多环境编排。
- pipeline 能天然支持未来新增 environment。

---

## 5. Cross-Cutting Tasks

这些任务要贯穿所有里程碑执行。

### 5.1 Types

- 所有新对象都要先定义类型，再实现逻辑。
- 严禁继续扩大 `unknown` 的传播范围。
- `vite.plugins` 的类型可以先保持宽松，但要收拢在 `vite` 命名空间内。

### 5.2 Testing

每个里程碑至少包含：

- 单元测试
- 集成测试
- dev 行为测试
- 兼容测试

推荐新增测试目录：

```text
packages/ikaros/tests/
  config/
  plugin/
  instance/
  inspect/
```

测试策略细分：

- **单元测试**：config normalize、compat shim、plugin hook 执行顺序
- **集成测试**：用 `createConfig()` 输出的配置快照做断言，不真正启动 dev server
- **Smoke test**：只在 CI 上跑，本地开发用 example 项目手动验证

### 5.3 Documentation

每完成一个里程碑，都同步更新：

- `packages/ikaros/readme.md`
- 配置示例
- 迁移说明

### 5.4 Migration Messaging

所有兼容字段都需要：

- 明确 warning 文案
- 文档中的迁移前后对照
- 版本移除计划

## 6. Recommended Execution Order

建议按以下顺序执行：

| 顺序 | 里程碑                    | 理由                                                   |
| ---- | ------------------------- | ------------------------------------------------------ |
| 1    | **M0: Baseline**          | 安全网                                                 |
| 2    | **M1: Instance API**      | 所有后续改造的载体（插件、config pipeline 都需要实例） |
| 3    | **M2: Config Namespace**  | 配置边界清晰化                                         |
| 4    | **M3: Normalized Config** | 内部消费统一                                           |
| 5    | **M4: Plugin System**     | 基于实例 + 规范化配置的扩展点                          |
| 6    | **M5: Inspect**           | 可观察性                                               |
| 7    | M6: Environment           | 按需推迟，真正需要 SSR 时再启动                        |

核心原则：**先有实例，再有配置管线，最后才开放扩展点**。

对齐 rsbuild 的架构顺序：`createRsbuild()` → `initRsbuildConfig()` → `initPlugins()` → `generateRspackConfig()`。

## 7. Risks

### Risk 1: Compatibility Drift

如果过早移除旧配置字段，用户项目会直接断裂。

处理方式：

- 先兼容迁移
- 后告警
- 最后移除

### Risk 2: Plugin Boundary Blur

如果 ikaros plugin 和 bundler plugin 边界没写清楚，用户会继续混淆两套能力。

处理方式：

- 对齐 rsbuild 的 `{ name, setup(api) }` 签名，让用户概念上熟悉
- API 命名明确区分（`plugins` vs `rspack.plugins` / `vite.plugins`）
- 文档中单独列"不要这样用"
- schema 和运行时校验双重限制

### Risk 3: Environment Refactor Too Early

过早切环境模型，容易把 desktop 支持和 CLI 行为一起打散。

处理方式：

- 先完成 normalized config、instance API、inspect
- 最后再切 environment 编排

## 8. Definition of Done

当以下条件全部满足时，本次改造完成：

1. dev/build/watch 生命周期已经实例化并具备 `close()`（`createIkaros()` 模式）。
2. bundler 特有配置已经全部显式命名空间化。
3. 内部所有编译逻辑只消费 normalized config（所有字段非可选）。
4. 已存在 ikaros plugin system，签名对齐 rsbuild（`{ name, setup(api) }`），且与 bundler plugin 明确隔离。
5. `create-web-rspack-config.ts` 中至少 2 个关注点已拆为内置插件。
6. inspect 能导出完整配置链路。
7. 全量测试绿色，旧配置仍可运行并有明确迁移提示。
8. （可选）platform 内部已迁移到 environment 驱动编排——仅在需要 SSR 时作为完成条件。

## 9. Suggested First PR Series

为了避免单个 PR 过大，建议从以下 6 个 PR 开始（按执行顺序）：

1. `refactor(core): introduce instance api and scoped cleanup registry`
   - 创建 `createIkaros()` 实例入口
   - 将全局 cleanup registry 改为实例级
   - CLI 内部委托给 instance
2. `refactor(config): add rspack namespace and compatibility shim`
   - 新增 `rspack`/`vite` 命名空间
   - 顶层 `plugins` 字段用于框架插件
   - 旧字段兼容迁移 + deprecation warning
3. `refactor(config): introduce normalized config pipeline`
   - `NormalizedConfig` 所有字段非可选
   - 吸收 `resolve-web-preconfig.ts` 的派生逻辑
   - 精简 `CreateConfigParams` 为 bundler-agnostic
4. `feat(core): add ikaros plugin system aligned with rsbuild protocol`
   - `IkarosPlugin` 签名对齐 rsbuild
   - 实现 hook container + plugin manager
   - 从 `create-web-rspack-config.ts` 拆 2~3 个内置插件
5. `feat(inspect): add inspect config output and diagnostics`
   - `ikaros.inspectConfig()` + `ikaros inspect` CLI
6. `refactor(config): split create-web-rspack-config into builtin plugins`
   - 逐步将剩余关注点拆为内置插件

完成这 6 个 PR 后，按需启动 environment-oriented 改造。
