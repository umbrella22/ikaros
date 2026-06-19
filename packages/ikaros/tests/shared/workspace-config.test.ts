import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { parse } from 'yaml'
import { describe, expect, it } from 'vitest'

describe('pnpm workspace config', () => {
  it('allowBuilds 应使用明确的布尔配置', () => {
    const workspaceConfig = parse(
      readFileSync(resolve(process.cwd(), '../../pnpm-workspace.yaml'), 'utf8'),
    ) as {
      allowBuilds?: Record<string, unknown>
    }

    expect(workspaceConfig.allowBuilds?.['@parcel/watcher']).toBe(true)
  })
})
