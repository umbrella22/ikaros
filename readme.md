# ikaros

一个基于 Rspack 的前端构建/开发 CLI，支持 web 与可选的 desktopClient（Electron）平台。

## 安装

```bash
pnpm add -D @ikaros-cli/ikaros
```

## Web（默认）

```bash
ikaros --mode development
ikaros build --mode release
```

## desktopClient（Electron，可选）

desktopClient 平台的编译与运行能力已从核心包中剥离，只有在启用 `--platform desktopClient` 时才会从项目依赖中按需加载。

```bash
pnpm add -D @ikaros-cli/ikaros-platform-desktop-client electron
```

```bash
ikaros --platform desktopClient --mode development
ikaros build --platform desktopClient --mode release
```

## 文档

- CLI/Web 配置文档：packages/ikaros/readme.md
