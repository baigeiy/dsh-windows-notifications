/** Bounded calls to the local Windows notification helpers. */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const directory = dirname(fileURLToPath(import.meta.url))

export function pythonPath() {
  const bundled = join(directory, 'runtime/python.exe')
  if (existsSync(bundled)) return bundled
  const development = join(directory, '.venv/Scripts/python.exe')
  if (existsSync(development)) return development
  throw new Error(`Windows notification runtime is missing. Run setup.ps1 in an administrator PowerShell from ${directory}.`)
}

export function runNative(script, input) {
  return new Promise((resolve, reject) => {
    const child = spawn(pythonPath(), [join(directory, script)], {
      windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], timeout: 15000,
    })
    let output = ''
    let error = ''
    child.stdout.setEncoding('utf8').on('data', chunk => { output = (output + chunk).slice(-4096) })
    child.stderr.setEncoding('utf8').on('data', chunk => { error = (error + chunk).slice(-4096) })
    child.on('error', reject)
    child.stdin.on('error', reject)
    child.once('close', code => code === 0 ? resolve(output.trim()) : reject(new Error(`Windows notification helper failed (${code}): ${error}`)))
    child.stdin.end(input === undefined ? '' : JSON.stringify(input))
  })
}
