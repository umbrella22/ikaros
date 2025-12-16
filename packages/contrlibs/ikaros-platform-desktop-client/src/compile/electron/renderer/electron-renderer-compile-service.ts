import {
  Command,
  type CompileServeParame,
  LoggerSystem,
  WebCompileService,
} from '@ikaros-cli/ikaros'

const { error, info } = LoggerSystem()

const toDesktopClientParams = (
  parame: CompileServeParame,
): CompileServeParame => {
  return {
    ...parame,
    options: {
      ...parame.options,
      platform: 'desktopClient',
    },
  }
}

export class ElectronRendererCompileService {
  /**
   * 启动渲染进程开发服务器
   * @returns 渲染进程端口号
   */
  static async dev(parame: CompileServeParame): Promise<number> {
    return new Promise<number>((resolve, reject) => {
      try {
        WebCompileService.create({
          ...toDesktopClientParams(parame),
          command: Command.SERVER,
          onBuildStatus: (status) => {
            if (status.success) {
              resolve(status.port!)
            } else {
              reject(new Error(status.message))
            }
          },
        })
      } catch (err) {
        error({ text: `❌ 渲染进程启动失败: ${err}` })
        reject(err)
      }
    })
  }

  /**
   * 构建渲染进程
   */
  static async build(parame: CompileServeParame): Promise<string | undefined> {
    return new Promise<string | undefined>((resolve, reject) => {
      try {
        info({ text: '🔨 开始构建渲染进程...' })
        WebCompileService.create({
          ...toDesktopClientParams(parame),
          command: Command.BUILD,
          onBuildStatus: (status) => {
            if (status.success) {
              info({ text: `✅ 渲染进程构建完成: ${status.message}` })
              resolve(status.message)
            } else {
              error({ text: `❌ 渲染进程构建失败: ${status.message}` })
              reject(new Error(status.message))
            }
          },
        })
      } catch (err) {
        error({ text: `❌ 渲染进程构建失败: ${err}` })
        reject(err)
      }
    })
  }
}
