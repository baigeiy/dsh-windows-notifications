/** Root-conversation text notifications; no routes, settings or browser activation. */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { messageText, notification } from './content.mjs'

export const name = 'windows-notifications-lite'
export const inject = ['agents', 'sessionProjections']
const directory = dirname(fileURLToPath(import.meta.url))

/** Observe root-agent events; disposal stops and awaits all notification senders. */
export function apply(ctx, config = {}) {
  if (process.platform !== 'win32') throw new Error('此插件只支持 Windows 10/11。')
  if (!existsSync(join(directory, 'foreground.dll'))) throw new Error('缺少 foreground.dll，请使用完整的精简版插件目录。')
  const timeoutMs = config.timeoutMs ?? 15000
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1) throw new Error('timeoutMs 必须为正整数。')
  const logger = ctx.logger(name)
  const pending = new Map()
  let disposed = false
  const root = session => ctx.agents.roots().some(agent => agent.session === session)
  const send = (session, detail, kind) => {
    if (disposed) return
    try {
      const title = ctx.sessionProjections.stateOf(session, 'title')
      const payload = notification(session, title, detail, kind)
      const child = spawn(join(process.env.SystemRoot ?? 'C:/Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe'),
        ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', join(directory, 'notify.ps1')],
        { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'], timeout: timeoutMs })
      let stderr = ''
      child.stderr.setEncoding('utf8').on('data', chunk => { stderr = (stderr + chunk).slice(-4096) })
      child.stdout.resume()
      const done = new Promise(resolve => {
        child.on('error', error => { if (!disposed) logger.warn('无法发送 Windows 通知，请检查插件目录及系统通知权限：%s', String(error)) })
        child.once('close', (code, signal) => {
          pending.delete(child)
          if (!disposed && (code !== 0 || signal !== null)) logger.warn('Windows 通知未确认提交（退出码 %s，信号 %s）：%s', code, signal, stderr)
          resolve()
        })
      })
      pending.set(child, done)
      child.stdin.on('error', error => { if (!disposed) logger.warn('通知内容发送失败：%s', String(error)) })
      child.stdin.end(JSON.stringify(payload))
    } catch (error) {
      logger.warn('无法准备 Windows 通知，请检查插件及 DSH 日志：%s', String(error))
    }
  }
  ctx.effect(() => async () => {
    disposed = true
    const children = [...pending]
    for (const [child] of children) child.kill()
    await Promise.all(children.map(([, done]) => done))
  }, 'windows-notifications-lite: notification senders')
  ctx.on('user-questions/request', (request, next) => {
    if (!request.signal?.aborted && request.agent !== undefined && root(request.agent.session)) {
      send(request.agent.session, request.questions.map(item => item.question).join('；'), 'question')
    }
    return next()
  }, { global: true, prepend: true })
  ctx.on('session/event', (session, event) => {
    if (!root(session)) return
    if (event.type === 'approval/asked') send(session, event.data.reason ?? event.data.toolName, 'approval')
    if (event.type === 'turn/end' && event.data.reason.kind === 'completed') {
      const questions = ctx.sessionProjections.stateOf(session, 'userQuestions')
      if (questions?.questions.active.length > 0) return
      const events = session.snapshotEvents()
      let detail = ''
      for (let index = events.length - 1; index >= 0; index--) {
        if (events[index].type === 'turn/start') break
        if (events[index].type === 'assistant/message' && !events[index].data.interrupted) {
          detail = messageText(events[index].data.message)
          if (detail.trim()) break
        }
      }
      send(session, detail || '本轮对话已完成。', 'completed')
    }
  }, { global: true })
}
