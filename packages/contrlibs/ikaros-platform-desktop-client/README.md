# @ikaros-cli/ikaros-platform-desktop-client

Electron desktopClient platform adapter for `@ikaros-cli/ikaros`.

只有当用户运行 `ikaros --platform desktopClient` 时，core 才会从用户项目依赖中按需加载本包。

## 安装

```bash
pnpm add -D @ikaros-cli/ikaros-platform-desktop-client electron
```

## 运行

```bash
ikaros --platform desktopClient --mode development
ikaros build --platform desktopClient --mode release
```

## Platform 行为

desktopClient 平台只负责生成和编排 BuildPlan：

- `electron-main`：固定 Rspack。
- `electron-preload`：固定 Rspack。
- `electron-renderer`：跟随 `bundle.adapter`，可以是 Rspack 或 Vite。

dev 流程：

1. 启动 renderer dev server。
2. watch main/preload Rspack build。
3. 启动 Electron 进程。

build 流程：

- renderer 为 Rspack 时，main/preload/renderer 合并为一次 Rspack build。
- renderer 为 Vite 时，main/preload 使用 Rspack，renderer 使用 Vite adapter。

## 默认输出

- main: `dist/electron/main`
- preload: `dist/electron/preload`
- renderer: `dist/electron/renderer`

本包只从 `@ikaros-cli/ikaros/adapter` 读取稳定 contract，不依赖 core 内部构建实现。
