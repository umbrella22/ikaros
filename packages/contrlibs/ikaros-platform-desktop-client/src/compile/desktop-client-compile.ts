import type { CompileServeParame } from '@ikaros-cli/ikaros'

import { ElectronCompileService } from './electron'

export const startDesktopClientCompile = async (
  parame: CompileServeParame,
): Promise<void> => {
  await ElectronCompileService.create(parame)
}
