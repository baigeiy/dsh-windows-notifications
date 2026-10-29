/** Isolated preference and old-notification activation checks; no live settings or windows. */
import assert from 'node:assert/strict'
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Readable, PassThrough } from 'node:stream'
import { EventEmitter } from 'node:events'
import childProcess from 'node:child_process'
import { syncBuiltinESMExports } from 'node:module'

const directory = dirname(fileURLToPath(import.meta.url))
const harnessRoot = resolve(process.env.DSH_CHECKOUT ?? join(directory, '..'))
const { Context } = await import(pathToFileURL(join(harnessRoot, 'vendor/cordis/lib/index.js')).href)
mkdirSync(join(directory, 'build/tmp'), { recursive: true })
const isolated = mkdtempSync(join(directory, 'build/tmp/open-setting-'))
assert.equal(dirname(isolated), join(directory, 'build/tmp'))
const originalSpawn = childProcess.spawn
const scripts = []
const notifications = []
let ctx
try {
  for (const file of ['preferences.mjs', 'web-v4.mjs', 'native.mjs', 'index-v5.mjs', 'receipts.mjs']) copyFileSync(join(directory, file), join(isolated, file))
  mkdirSync(join(isolated, 'runtime'))
  writeFileSync(join(isolated, 'runtime/python.exe'), '')
  const { readPreferences, writePreferences } = await import(pathToFileURL(join(isolated, 'preferences.mjs')).href)
  assert.equal(readPreferences().openDshOnClick, true)
  writePreferences({ notifyWhenFocused: true })
  assert.equal(readPreferences().openDshOnClick, true)
  writePreferences({ openDshOnClick: false })
  assert.equal(readPreferences().openDshOnClick, false)
  for (const invalid of ['false', 0, null]) {
    assert.throws(() => writePreferences({ openDshOnClick: invalid }), /openDshOnClick must be a boolean/u)
    assert.equal(readPreferences().openDshOnClick, false)
  }
  childProcess.spawn = (_executable, args) => {
    scripts.push(args[0])
    const child = new EventEmitter()
    child.stdin = new PassThrough()
    child.stdout = new PassThrough()
    child.stderr = new PassThrough()
    let input = ''
    child.stdin.on('data', chunk => { input += chunk })
    child.stdin.once('finish', () => {
      if (args[0].endsWith('notify-v3.py')) notifications.push(JSON.parse(input))
      child.stdout.end(args[0].endsWith('reuse-browser.py') ? '{"reused":true,"closed":false}' : 'cleared')
      setImmediate(() => child.emit('close', 0))
    })
    return child
  }
  syncBuiltinESMExports()
  const { attachWeb } = await import(pathToFileURL(join(isolated, 'web-v4.mjs')).href)
  const receipts = new Map()
  const routes = new Map()
  ctx = new Context()
  ctx.provide('webServer', { register(route) { routes.set(route.path, route.handler); return () => routes.delete(route.path) } })
  ctx.provide('connection', { requestRejection: () => undefined })
  await ctx.plugin({ apply: scope => attachWeb(scope, new Map(), undefined, receipts) })
  const request = async (path, method = 'GET', host = '127.0.0.1:3080') => {
    const req = Readable.from([])
    req.method = method
    req.url = path
    req.headers = { host }
    let status = 200, content = ''
    const res = { headersSent: false, setHeader() {}, writeHead(code) { status = code; this.headersSent = true; return this }, end(value = '') { content = String(value) } }
    await routes.get(path.split('?')[0])(req, res)
    return { status, content }
  }
  receipts.set('before-disable', { tag: 'old-notification', time: Date.now() })
  const acknowledged = await request('/dsh-notifications/ack?token=before-disable')
  assert.equal(acknowledged.status, 200)
  assert.match(acknowledged.content, /if\(result.openingDisabled\)/u)
  assert.equal(scripts.filter(script => script.endsWith('clear.py')).length, 1)
  assert.equal((await request('/dsh-notifications/reuse?token=before-disable', 'POST', 'invalid.example')).status, 403)
  const disabled = await request('/dsh-notifications/reuse?token=before-disable', 'POST')
  assert.deepEqual(JSON.parse(disabled.content), { reused: false, closed: false, openingDisabled: true })
  assert.equal(scripts.some(script => script.endsWith('reuse-browser.py')), false)
  assert.equal(receipts.has('before-disable'), false)
  writePreferences({ openDshOnClick: true })
  receipts.set('enabled', { tag: 'new-notification', time: Date.now(), acknowledged: true })
  const enabled = await request('/dsh-notifications/reuse?token=enabled', 'POST')
  assert.deepEqual(JSON.parse(enabled.content), { reused: true, closed: false })
  assert.equal(scripts.filter(script => script.endsWith('reuse-browser.py')).length, 1)
  await ctx.fiber.dispose()
  assert.equal(routes.size, 0)
  const plugin = await import(pathToFileURL(join(isolated, 'index-v5.mjs')).href)
  ctx = new Context()
  const session = { id: 'root', header: { cwd: 'E:/test-project' } }
  const root = { session }
  ctx.provide('agents', { roots: () => [root] })
  await ctx.plugin(plugin)
  const ask = async () => {
    await ctx.waterfall('user-questions/request', { agent: root, questions: [{ question: '继续吗？' }] }, () => Promise.resolve('answer'))
    await new Promise(setImmediate)
  }
  writePreferences({ openDshOnClick: false })
  await ask()
  assert.equal(notifications.at(-1).openDshOnClick, false)
  assert.equal(Object.hasOwn(notifications.at(-1), 'url'), false)
  writePreferences({ openDshOnClick: true })
  await ask()
  assert.equal(notifications.at(-1).openDshOnClick, true)
  assert.match(notifications.at(-1).url, /^dsh-local-notification:\/\/open\?token=/u)
  console.log('PASS: default-on compatibility, persisted toggle, invalid input, old-toast dismiss-only activation, live sender settings, enabled reuse, host validation and disposal')
} finally {
  await ctx?.fiber.dispose()
  childProcess.spawn = originalSpawn
  syncBuiltinESMExports()
  rmSync(isolated, { recursive: true })
}
