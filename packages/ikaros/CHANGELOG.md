# @ikaros-cli/ikaros

## [3.2.0](https://github.com/umbrella22/ikaros/compare/@ikaros-cli/ikaros@v3.1.0...@ikaros-cli/ikaros@v3.2.0) (2026-07-23)


### Features

* update minimum release versions and add new dependencies ([9720311](https://github.com/umbrella22/ikaros/commit/9720311fc0f266b0cce8eac07193a169fceea850))

## [3.1.0](https://github.com/umbrella22/ikaros/compare/@ikaros-cli/ikaros@v3.0.0...@ikaros-cli/ikaros@v3.1.0) (2026-07-16)


### Features

* Pages配置允许携带其他参数 ([43abff5](https://github.com/umbrella22/ikaros/commit/43abff50ac7bee6de1e9ddbb41d121be6b84ee76))
* QAQ ([9e01f9f](https://github.com/umbrella22/ikaros/commit/9e01f9f7d7eaec31b607ecf1df05703c8ddf6afe))
* **scripts:** 添加 lint:fix 脚本并标准化代码引号 ([2427828](https://github.com/umbrella22/ikaros/commit/24278281e820ad74ca6ba64655b549ef5e1502c5))
* update pnpm workspace configuration and enhance readme with new features and usage instructions ([fea959a](https://github.com/umbrella22/ikaros/commit/fea959abc3de4fb53ab05b35baaab5aad3407095))
* **vue3-vite:** 新增vue3+vite示例项目及相关配置 ([8cba569](https://github.com/umbrella22/ikaros/commit/8cba569d3ab66ced94b6e7d8a470c16e42950765))
* **watchdog:** 添加看门狗机制支持配置文件和环境变量热重载 ([81faf3e](https://github.com/umbrella22/ikaros/commit/81faf3ecb8fcb1cfccf880b5d39d834e7a4e173c))
* web mode created ([9b34640](https://github.com/umbrella22/ikaros/commit/9b346405dc517f078e9a1152ac0392cd212a3197))
* web就绪 ([270dd5d](https://github.com/umbrella22/ikaros/commit/270dd5dc9d23a4bf9313a2b1ccbc7a75f8834950))
* 修改了加载模式，但是文件读取有些问题，稍后再看 ([9daef80](https://github.com/umbrella22/ikaros/commit/9daef80e4ad09f290596beb1f4acbe3e16405061))
* 剥离utils文件函数，拆散为更利于维护的单文件 ([f7f763c](https://github.com/umbrella22/ikaros/commit/f7f763ca8d25ff064e139dee41603bba4d4b2bd1))
* 升级依赖，优化配置文件加载速度 ([de75a54](https://github.com/umbrella22/ikaros/commit/de75a547ed3f724eb58f7a5de7057a0486324a72))
* 增强库配置和编译管道，支持多入口和文件名自定义 ([43f9292](https://github.com/umbrella22/ikaros/commit/43f92928155d10d9fee6a72e846e127d81dd9d0c))
* 扩展 Vite 默认扩展名支持 rspack 的 '...' 展开语法，并更新相关测试 ([ad946c4](https://github.com/umbrella22/ikaros/commit/ad946c48298fabdaf5f472124b8bbd8a263c1a63))
* 支持可选页面启动配置，优化多页面资产创建逻辑 ([647ae93](https://github.com/umbrella22/ikaros/commit/647ae930d201927a296b13acadb9ec40c4436ba6))
* 新增库模式支持，为 React 和 Vue 添加示例项目 ([918bc82](https://github.com/umbrella22/ikaros/commit/918bc821a4eef24c3232a01482aec8aff997d389))
* 新增静默模式并重构警告处理 ([ba97705](https://github.com/umbrella22/ikaros/commit/ba977059d548a8a0b791023b83526bbd827c1fe2))
* 更换oxc为配置文件转义 ([2dcad3c](https://github.com/umbrella22/ikaros/commit/2dcad3ccd4db694a9d62aa42bf4ac0a9e250448e))
* 更新axios、@types/node、@rspack/core、vitest及eslint相关依赖至最新版本 ([466dbfa](https://github.com/umbrella22/ikaros/commit/466dbfafc170a0eec0da27e5c32911f18f6f8826))
* 更新eslint和stylelint规则依赖，发布新版本 ([19d1ba6](https://github.com/umbrella22/ikaros/commit/19d1ba6749b02074d6e8dc163b61e39bb17167e3))
* 更新eslint规则，web已经就绪，等待模版 ([1e3fae1](https://github.com/umbrella22/ikaros/commit/1e3fae10365ba12dadbc517e5f72d939d6083f38))
* 更新版本号 ([fee6733](https://github.com/umbrella22/ikaros/commit/fee673379863bd36d5dcacd5908b9ed3fe93686a))
* 更新版本号至1.1.0，修改使用文档标题 ([0880617](https://github.com/umbrella22/ikaros/commit/0880617bf59cde05d8c464ef2e40bb475bc7b793))
* 更新版本至1.1.1，修复类型问题及环境变量导入错误 ([42a020c](https://github.com/umbrella22/ikaros/commit/42a020c769c46113621976bed208887dbb2ac153))
* 添加cdn插件，添加说明 ([ab052bf](https://github.com/umbrella22/ikaros/commit/ab052bf936f225214a96d6539076b5b251f41ebc))
* 添加react19 demo ([fae4fbf](https://github.com/umbrella22/ikaros/commit/fae4fbf9ac94688d8623e433bd43471cb2994f8d))
* 添加移动端插件 ([bce8d78](https://github.com/umbrella22/ikaros/commit/bce8d78847a9424fcf7d1cb545027f6bdfd3d04b))
* 添加配置文件类型校验，重命名编译层文件 ([1bb9f97](https://github.com/umbrella22/ikaros/commit/1bb9f9746ad86aeff34cf13276b3b296bddc9cea))
* 调整配置，并添加vue2.7和vue3示例，后续追加react示例 ([690bde0](https://github.com/umbrella22/ikaros/commit/690bde0c50bf1db66aa8598229e6da2688e85005))
* 重构cli ([e27a675](https://github.com/umbrella22/ikaros/commit/e27a6759c3af3b25106a385d3f76e1f18d0e8165))
* 重构日志系统，替换原有日志方法为LoggerSystem，增强日志功能 ([a0557ad](https://github.com/umbrella22/ikaros/commit/a0557ad1e7eee6d8c3f36a5f86a861f9ae4f98fa))
* 重构编译架构，引入平台与打包器适配器模式 ([a1cacbe](https://github.com/umbrella22/ikaros/commit/a1cacbe8783a07f074b6d0bf98f758b7fe3a03e4))


### Bug Fixes

* change some sth ([14d06d6](https://github.com/umbrella22/ikaros/commit/14d06d6b2f47470fa38fb6ab0036cd93c0a6282e))
* update dep ([91801fa](https://github.com/umbrella22/ikaros/commit/91801fa6b8b98022f5a9a1b0582de8a93b3cbee2))
* 优化配置 ([0e5fb84](https://github.com/umbrella22/ikaros/commit/0e5fb841d962c284eda6079d6d15896438338e49))
* 修复ts配置类型丢失 ([e27a250](https://github.com/umbrella22/ikaros/commit/e27a250d6ce1f24a2aca20424b3d04f0f6b0f4b5))
* 修复其他错误 ([e28e03c](https://github.com/umbrella22/ikaros/commit/e28e03cef5d75af8addb3d038dc7bc991654ea99))
* 修复写法问题 ([ce0af5a](https://github.com/umbrella22/ikaros/commit/ce0af5aee01c62d65298a7a02b62cb615c8050c4))
* 修复静态资源重定向时会出现预料之外的问题 ([ec71405](https://github.com/umbrella22/ikaros/commit/ec714052063beffec7b038999c3f1ba0d8fe025c))
* 修改格式错误 ([c262780](https://github.com/umbrella22/ikaros/commit/c2627808b12421b6bb7e56c570be5e562754d21b))
* 将以esm模式运行，并固定配置文件格式 ([2af8721](https://github.com/umbrella22/ikaros/commit/2af87218acac93f4b670c0304eac849375d2d0b3))
* 更新，但是有点bug，等下看 ([19100ee](https://github.com/umbrella22/ikaros/commit/19100ee66348f21e45af07aa1ecd5845f8c815e0))
* 添加端口最小（大）限制 ([83d34d9](https://github.com/umbrella22/ikaros/commit/83d34d924a0fda782e5aad3d340c126dfc867acc))
* 添加运行脚本 ([984427d](https://github.com/umbrella22/ikaros/commit/984427d5855b16d0d458588fd8e35a362e73fa89))
* 调整构建时优化 ([b485898](https://github.com/umbrella22/ikaros/commit/b4858982e48640de51217139fe4e509fc33a741a))

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
