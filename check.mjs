/** Test observer lifecycle, visible content, native focus matching and toast XML. */
import assert from 'node:assert/strict'
import test from 'node:test'
import childProcess, { spawnSync } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { syncBuiltinESMExports } from 'node:module'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { messageText, notification } from './content.mjs'

const directory = fileURLToPath(new URL('.', import.meta.url))
const session = { id: 'session-123', header: { cwd: 'E:\\项目\\示例项目' } }

test('conversation name, project and visible detail occupy separate rows', () => {
  assert.deepEqual(notification(session, '修复通知', '已经\n完成', 'completed'), {
    title: '修复通知', project: '示例项目', detail: '已经 完成', tag: '2a2492973325172d',
  })
  assert.equal(notification(session, null, '问题', 'question').title, session.id)
  assert.equal(notification({ ...session, header: { cwd: 'E:/项目/示例项目/' } }, '名称', '', 'question').project, '示例项目')
  assert.equal(messageText({ content: [{ type: 'reasoning', text: '私有推理' }, { type: 'tool-call', arguments: '机密' }, { type: 'text', text: '可见回复' }] }), '可见回复')
})

test('native payload preserves Unicode and XML escaping without pictures or activation URLs', () => {
  const payload = notification(session, '对话 <一> & "二"', '请选 A & B < C', 'question')
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', `${directory}notify.ps1`, '-ValidateOnly'], { input: JSON.stringify(payload), encoding: 'utf8', windowsHide: true })
  assert.equal(result.status, 0, result.stderr)
  const parsed = JSON.parse(result.stdout)
  assert.deepEqual([...parsed.xml.matchAll(/<text>(.*?)<\/text>/gu)].map(match => match[1]), [
    '示例项目', '对话 &lt;一&gt; &amp; "二"', '请选 A &amp; B &lt; C',
  ])
  assert.doesNotMatch(parsed.xml, /<image|protocol|launch=|打开 dsh/u)
  assert.match(parsed.xml, /activationType="system" arguments="dismiss"/u)
  assert.equal(typeof parsed.focused, 'boolean')
  const source = readFileSync(new URL('./notify.ps1', import.meta.url), 'utf8')
  assert.ok(source.indexOf('skipped-focused') < source.indexOf('CreateSubKey'))
  const focus = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `Add-Type -Path '${directory}foreground.dll'; @([DshLiteForeground]::MatchesTitle('修复通知 — DeepSeek Harness - Microsoft Edge'), [DshLiteForeground]::MatchesTitle('DeepSeek Harness - Google Chrome'), [DshLiteForeground]::MatchesTitle('DeepSeek Harness guide - GitHub - Microsoft Edge'), [DshLiteForeground]::MatchesTitle('其他窗口')) | ConvertTo-Json -Compress`], { encoding: 'utf8', windowsHide: true })
  assert.equal(focus.status, 0, focus.stderr)
  assert.deepEqual(JSON.parse(focus.stdout), [true, true, false, false])
})

test('root observers preserve answers, ignore children and incomplete turns, and await disposal', async () => {
  const original = childProcess.spawn
  const sent = []
  const children = []
  let automaticClose = true
  childProcess.spawn = () => {
    const child = new EventEmitter()
    child.stdin = new PassThrough()
    child.stdout = new PassThrough()
    child.stderr = new PassThrough()
    let input = ''
    child.stdin.on('data', data => { input += data })
    child.stdin.on('finish', () => { sent.push(JSON.parse(input)); if (automaticClose) setImmediate(() => child.emit('close', 0, null)) })
    child.kill = () => { child.killed = true; setImmediate(() => child.emit('close', null, 'SIGTERM')) }
    children.push(child)
    return child
  }
  syncBuiltinESMExports()
  try {
    const { apply } = await import('./index.mjs')
    const root = { session }
    const child = { session: { ...session, id: 'child' } }
    let active = []
    let title = '修复通知'
    const events = []
    session.snapshotEvents = () => events
    const handlers = new Map()
    let cleanup
    const warnings = []
    const ctx = {
      agents: { roots: () => [root] },
      sessionProjections: { stateOf: (_session, key) => key === 'title' ? title : { questions: { active } } },
      logger: () => ({ warn: (...args) => warnings.push(args) }),
      effect: callback => { cleanup = callback() },
      on: (name, callback) => { handlers.set(name, callback) },
    }
    apply(ctx)
    const request = { agent: root, questions: [{ question: '选 A 还是 B？' }] }
    const answer = { answer: 'A' }
    assert.equal(handlers.get('user-questions/request')(request, () => answer), answer)
    handlers.get('user-questions/request')({ ...request, agent: child }, () => answer)
    handlers.get('user-questions/request')({ ...request, signal: AbortSignal.abort() }, () => answer)
    await new Promise(setImmediate)
    assert.equal(sent.length, 1)
    assert.deepEqual([sent[0].title, sent[0].project, sent[0].detail], ['修复通知', '示例项目', '选 A 还是 B？'])
    const emit = (type, data) => handlers.get('session/event')(session, { type, data })
    emit('approval/asked', { reason: '允许执行构建吗？' })
    events.push({ type: 'turn/start' }, { type: 'assistant/message', data: { message: { content: [{ type: 'text', text: '已修复图片显示。' }] } } })
    title = '已经重命名的对话'
    emit('turn/end', { reason: { kind: 'completed' } })
    await new Promise(setImmediate)
    assert.equal(sent.length, 3)
    assert.equal(sent[2].title, title)
    assert.equal(sent[2].detail, '已修复图片显示。')
    for (const kind of ['error', 'aborted', 'blocked', 'interrupted']) emit('turn/end', { reason: { kind } })
    active = [{}]
    emit('turn/end', { reason: { kind: 'completed' } })
    handlers.get('session/event')(child.session, { type: 'approval/asked', data: { toolName: 'shell' } })
    await new Promise(setImmediate)
    assert.equal(sent.length, 3)
    active = []
    automaticClose = false
    emit('approval/asked', { toolName: 'shell' })
    await new Promise(setImmediate)
    await cleanup()
    assert.equal(children.at(-1).killed, true)
    emit('approval/asked', { toolName: 'shell' })
    assert.equal(sent.length, 4)
    assert.deepEqual(warnings, [])
  } finally {
    childProcess.spawn = original
    syncBuiltinESMExports()
  }
})
