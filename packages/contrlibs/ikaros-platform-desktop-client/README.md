# @ikaros-cli/ikaros-platform-desktop-client

为 `@ikaros-cli/ikaros` 提供 `desktopClient`（Electron）平台的可选编译/运行能力。

> 该包不会自动生效；仅当你在项目中使用 `ikaros --platform desktopClient` 时，ikaros 才会从项目依赖中按需加载它。

## 安装

在你的业务项目中安装（建议作为 devDependency）：

```bash
pnpm add -D @ikaros-cli/ikaros @ikaros-cli/ikaros-platform-desktop-client electron
```

## 使用

```bash
ikaros --platform desktopClient --mode development
ikaros build --platform desktopClient --mode release
```

## 导出

- `startDesktopClientCompile(parame)`：供 ikaros 在运行时动态加载并调用的入口。
