import { spawn } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const runSmoke = process.env.IKAROS_RUN_EXAMPLE_SMOKE === '1'
const smokeIt = runSmoke ? it : it.skip
const repoRoot = resolve(__dirname, '../../../..')
const running: Array<{ kill: () => void }> = []

type ExampleCase = {
  name: string
  dir: string
}

const examples: ExampleCase[] = [
  { name: 'rspack vue3', dir: 'examples/vue3' },
  { name: 'rspack react', dir: 'examples/react' },
  { name: 'vite vue3', dir: 'examples/vue3-vite' },
]

const libraryExamples: ExampleCase[] = [
  { name: 'rspack react library', dir: 'examples/react-lib' },
  { name: 'rspack vue3 library', dir: 'examples/vue3-lib' },
]

afterEach(() => {
  for (const item of running.splice(0)) {
    item.kill()
  }
})

describe('examples smoke', () => {
  smokeIt.each(examples)('$name build 输出关键产物', async (example) => {
    const cwd = join(repoRoot, example.dir)

    await runCommand('pnpm', ['exec', 'ikaros', 'build', '-m', 'dev'], cwd)

    expect(existsSync(join(cwd, 'dist', 'index.html'))).toBe(true)
  }, 60_000)

  smokeIt.each(examples)('$name dev server 可响应', async (example) => {
    const cwd = join(repoRoot, example.dir)
    const child = spawn('pnpm', ['exec', 'ikaros', '-m', 'dev'], {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    running.push({
      kill: () => child.kill('SIGTERM'),
    })

    await waitForHttp('http://127.0.0.1:3000/', 30_000)
  }, 60_000)

  smokeIt.each(libraryExamples)('$name build 输出库文件', async (example) => {
    const cwd = join(repoRoot, example.dir)

    await runCommand('pnpm', ['exec', 'ikaros', 'build', '-m', 'dev'], cwd)

    const outputDir = join(cwd, 'dist')
    expect(existsSync(outputDir)).toBe(true)
    expect(
      readdirSync(outputDir).some((file) => /\.(mjs|cjs|js)$/.test(file)),
    ).toBe(true)
  }, 60_000)
})

function runCommand(command: string, args: string[], cwd: string): Promise<void> {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let output = ''

    child.stdout.on('data', (chunk) => {
      output += String(chunk)
    })
    child.stderr.on('data', (chunk) => {
      output += String(chunk)
    })
    child.on('close', (code) => {
      if (code === 0) {
        resolveRun()
      } else {
        rejectRun(new Error(output))
      }
    })
  })
}

async function waitForHttp(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs
  let lastError: unknown

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url)
      if (response.ok) {
        return
      }
      lastError = new Error(`HTTP ${response.status}`)
    } catch (error) {
      lastError = error
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 500))
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}
