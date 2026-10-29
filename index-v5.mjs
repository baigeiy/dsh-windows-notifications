/** Local Windows toast notifications for human questions and completed root turns. */
import { spawn } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { appendFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { readPreferences } from './preferences.mjs'
import { attachWeb } from './web-v4.mjs'
import { ReceiptStore } from './receipts.mjs'
import { pythonPath } from './native.mjs'

export const name = 'local-windows-notifications'
export const inject = ['agents']
const directory = dirname(fileURLToPath(import.meta.url))

/** Attach reversible observers without changing question answers or Session events. */
export function apply(ctx, config = {}) {
  if (process.platform !== 'win32') throw new Error('Windows notifications require Windows')
  pythonPath()
  const baseUrl = new URL(config.baseUrl ?? 'http://127.0.0.1:3080/').href
  const timeoutMs = config.timeoutMs ?? 15000
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1) throw new Error('timeoutMs must be a positive integer')
  const pending = new Map()
  const clients = new Map()
  const acknowledgements = new ReceiptStore(error => ctx.logger(name).warn('Could not persist notification receipts: %s', String(error)))
  readPreferences()
  writeFileSync(join(directory, 'runtime.json'), `${JSON.stringify({ baseUrl })}\n`)
  let disposed = false
  const logger = ctx.logger(name)
  const record = (kind, fields = {}) => {
    try {
      appendFileSync(join(directory, 'events.jsonl'), `${JSON.stringify({ time: new Date().toISOString(), kind, ...fields })}\n`)
    } catch (error) {
      logger.warn('Could not write notification diagnostics: %s', String(error))
    }
  }
  const isRoot = agent => ctx.agents.roots().includes(agent)
  const send = (title, body, kind, sessionId, force = false) => {
    if (disposed) return
    let preferences
    try { preferences = readPreferences() }
    catch (error) {
      logger.warn('Could not read notification preferences: %s', String(error))
      record('failed', { notification: kind, sessionId, error: String(error) })
      return
    }
    title = preferences[kind === 'completed' ? 'completionTitle' : kind === 'approval' ? 'approvalTitle' : 'questionTitle']
    const tag = createHash('sha256').update(`${kind}-${sessionId ?? 'test'}`).digest('hex').slice(0, 16)
    const now = Date.now()
    for (const [key, receipt] of acknowledgements) if (now - receipt.time > 86400000) acknowledgements.delete(key)
    let token, openUrl
    if (preferences.openDshOnClick) {
      token = randomBytes(32).toString('base64url')
      acknowledgements.set(token, { tag, time: now })
      openUrl = new URL('dsh-local-notification://open')
      openUrl.searchParams.set('token', token)
    }
    const child = spawn(pythonPath(),
      [join(directory, 'notify-v3.py')],
      { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], timeout: timeoutMs })
    let stderr = ''
    let output = ''
    child.stderr.setEncoding('utf8').on('data', chunk => { stderr = (stderr + chunk).slice(-4096) })
    child.stdout.setEncoding('utf8').on('data', chunk => { output = (output + chunk).slice(-1024) })
    const done = new Promise(resolve => {
      child.on('error', error => {
        logger.warn('Windows notification failed: %s', String(error))
        record('failed', { notification: kind, sessionId, error: String(error) })
      })
      child.once('close', code => {
        pending.delete(child)
        if (token !== undefined && (code !== 0 || output.trim() === 'skipped-focused')) acknowledgements.delete(token)
        if (code === 0) record(output.trim() === 'skipped-focused' ? 'skipped-focused' : 'submitted', { notification: kind, sessionId })
        else if (!disposed) {
          logger.warn('Windows notification exited with %s: %s', code, stderr)
          record('failed', { notification: kind, sessionId, code, error: stderr })
        }
        resolve(code === 0 ? output.trim() || 'submitted' : 'failed')
      })
    })
    pending.set(child, done)
    child.stdin.on('error', error => {
      if (!disposed) logger.warn('Could not send notification text: %s', String(error))
    })
    child.stdin.end(JSON.stringify({ title, body: body.replace(/\s+/gu, ' ').slice(0, 220), url: openUrl?.href,
      ...preferences, pageFocused: [...clients.values()].some(time => Date.now() - time < 10000),
      notifyWhenFocused: force || preferences.notifyWhenFocused,
      icon: pathToFileURL(join(directory, preferences.notificationIcon === 'custom' ? 'custom-notification.png' : preferences.notificationIcon === 'official' ? 'official-whale.png' : 'whale-icon.png')).href,
      tag }))
    return done
  }

  attachWeb(ctx, clients, kind => send('', '这是一条测试通知，可点“确认收到”收起。', kind, undefined, true), acknowledgements, baseUrl)

  ctx.effect(() => async () => {
    disposed = true
    clients.clear()
    Map.prototype.clear.call(acknowledgements)
    const children = [...pending.entries()]
    for (const [child] of children) child.kill()
    await Promise.all(children.map(([, done]) => done))
    record('stopped')
  }, 'windows-notifications: pending senders')
  ctx.on('user-questions/request', (request, next) => {
    if (!request.signal?.aborted && (request.agent === undefined || isRoot(request.agent))) {
      send('大肥鱼问你话呢', request.questions.map(item => item.question).join('；'), 'question', request.agent?.session.id)
    }
    return next()
  }, { global: true, prepend: true })
  ctx.on('session/event', (session, event) => {
    if (!ctx.agents.roots().some(agent => agent.session === session)) return
    if (event.type === 'approval/asked') {
      send('大肥鱼问你话呢', event.data.reason ?? event.data.toolName, 'approval', session.id)
    } else if (event.type === 'turn/end' && event.data.reason.kind === 'completed') {
      const questions = ctx.get('sessionProjections')?.stateOf(session, 'userQuestions')
      if (questions?.questions.active.length > 0) return
      const workspace = session.header.cwd ? basename(session.header.cwd) : 'dsh'
      send('干完了喵', `${workspace}：回复已完成。`, 'completed', session.id)
    }
  }, { global: true })
  record('started', { pid: process.pid, baseUrl })
  logger.info('Windows notifications enabled for questions, approvals, and completed root turns')
}
