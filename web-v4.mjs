/** Authenticated local preferences page and per-document focus reports. */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readPreferences, writePreferences, DEFAULTS } from './preferences.mjs'
import { runNative } from './native.mjs'
const directory = dirname(fileURLToPath(import.meta.url))

export function attachWeb(ctx, clients, preview, acknowledgements = new Map(), baseUrl = 'http://127.0.0.1:3080/') {
  ctx.on('webserver/index-inject', table => {
    table.push({ kind: 'script', placement: 'body', text:
      '(()=>{const s=document.createElement("script");s.src="/dsh-notifications/focus.js";s.onerror=()=>{};document.head.append(s)})()' })
  })
  ctx.inject(['webServer', 'connection'], child => {
    const operations = new Set()
    const native = (script, input) => {
      const operation = runNative(script, input)
      operations.add(operation)
      void operation.then(() => operations.delete(operation), () => operations.delete(operation))
      return operation
    }
    child.effect(() => async () => { await Promise.allSettled([...operations]) }, 'windows-notifications: settings helpers')
    const add = (path, handler) => child.effect(() => child.webServer.register({ kind: 'exact', path,
      handler: async (req, res) => {
        const rejected = ['/dsh-notifications/ack', '/dsh-notifications/reuse'].includes(path) ? undefined : child.connection.requestRejection(req)
        if (rejected !== undefined) { res.writeHead(rejected).end('Please open dsh in this browser first.'); return }
        res.setHeader('Cache-Control', 'no-store')
        try { await handler(req, res) }
        catch (error) {
          child.logger('local-windows-notifications').warn('Notification settings request failed: %s', String(error))
          if (!res.headersSent) res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' })
          res.end('无法处理通知设置请求，请重试。')
        }
      } }))
    const json = (res, value) => res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' }).end(JSON.stringify(value))
    add('/dsh-notifications/ack', async (req, res) => {
      // A per-notification one-shot receipt permits only clearing that toast; it grants no browser-session access.
      const token = new URL(req.url ?? '/', 'http://local').searchParams.get('token')
      const receipt = acknowledgements.get(token)
      if (req.method !== 'GET' || req.headers.host !== new URL(baseUrl).host || receipt === undefined || Date.now() - receipt.time > 86400000) {
        res.writeHead(403).end('Invalid or expired notification receipt'); return
      }
      await native('clear.py', { tag: receipt.tag })
      receipt.acknowledged = true
      acknowledgements.set(token, receipt)
      const marker = `dsh-notification-receipt-${token.slice(0, 12)}`
      const endpoint = JSON.stringify(`/dsh-notifications/reuse?token=${token}`).replaceAll('<', '\\u003c')
      const destination = JSON.stringify(baseUrl).replaceAll('<', '\\u003c')
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'referrer-policy': 'no-referrer' }).end(`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>${marker}</title><body><p id="status">正在返回已打开的 dsh 页面…</p><script>fetch(${endpoint},{method:'POST'}).then(async r=>{if(!r.ok)throw Error();const result=await r.json();if(result.reused){document.getElementById('status').textContent='已返回原来的 dsh 页面，可以关闭此标签页';window.close()}else{location.replace(${destination})}}).catch(()=>{document.getElementById('status').textContent='无法切换到 dsh，请重试通知或手动选择已有标签页'})</script></body></html>`)
    })
    add('/dsh-notifications/reuse', async (req, res) => {
      const token = new URL(req.url ?? '/', 'http://local').searchParams.get('token')
      const receipt = acknowledgements.get(token)
      if (req.method !== 'POST' || req.headers.host !== new URL(baseUrl).host || !receipt?.acknowledged || Date.now() - receipt.time > 86400000) {
        res.writeHead(403).end('Invalid or expired notification receipt'); return
      }
      const marker = `dsh-notification-receipt-${token.slice(0, 12)}`
      acknowledgements.delete(token)
      const result = JSON.parse(await native('reuse-browser.py', { marker }))
      if (!res.destroyed) json(res, result)
    })
    const body = async req => {
      if (!String(req.headers['content-type']).startsWith('application/json')) throw new Error('Expected JSON')
      const chunks = []
      let size = 0
      for await (const chunk of req) {
        size += chunk.length
        if (size > 6 * 1024 * 1024) throw new Error('Request too large')
        chunks.push(chunk)
      }
      return JSON.parse(Buffer.concat(chunks).toString('utf8'))
    }
    add('/dsh-notifications', (req, res) => {
      if (req.method !== 'GET') { res.writeHead(405).end(); return }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(readFileSync(join(directory, 'settings-v3.html')))
    })
    for (const [path, file, type] of [
      ['/dsh-notifications/focus.js', 'focus.js', 'text/javascript; charset=utf-8'],
      ['/dsh-notifications/settings.js', 'settings.js', 'text/javascript; charset=utf-8'],
      ['/dsh-notifications/whale.png', 'whale.png', 'image/png'],
    ]) add(path, (req, res) => {
      if (req.method !== 'GET') { res.writeHead(405).end(); return }
      res.writeHead(200, { 'content-type': type }).end(readFileSync(join(directory, file)))
    })
    add('/dsh-notifications/preferences', async (req, res) => {
      if (req.method === 'GET') json(res, new URL(req.url ?? '/', 'http://local').searchParams.has('defaults') ? DEFAULTS : readPreferences())
      else if (req.method === 'POST') {
        const previous = readPreferences()
        const next = writePreferences(await body(req))
        try { await native('identity.py') }
        catch (error) { writePreferences(previous); throw error }
        json(res, next)
      }
      else res.writeHead(405).end()
    })
    add('/dsh-notifications/icon', (req, res) => {
      if (req.method !== 'GET') { res.writeHead(405).end(); return }
      const query = new URL(req.url, 'http://local').searchParams
      const role = query.get('role')
      const choice = query.get('choice')
      if (!['app', 'notification'].includes(role) || !['official', 'whale', 'custom'].includes(choice)) throw new Error('Invalid icon')
      const file = choice === 'custom' ? `custom-${role}.png` : choice === 'official' ? 'official-whale.png' : 'whale-icon.png'
      res.writeHead(200, { 'content-type': 'image/png' }).end(readFileSync(join(directory, file)))
    })
    add('/dsh-notifications/upload', async (req, res) => {
      if (req.method !== 'POST') { res.writeHead(405).end(); return }
      const value = await body(req)
      if (!['app', 'notification'].includes(value.role) || typeof value.data !== 'string' || value.data.length > 5600000) throw new Error('Invalid icon upload')
      await native('icons.py', value)
      json(res, { ok: true })
    })
    add('/dsh-notifications/preview', async (req, res) => {
      if (req.method !== 'POST') { res.writeHead(405).end(); return }
      const value = await body(req)
      if (!['question', 'completed'].includes(value.kind) || preview === undefined) throw new Error('Invalid preview')
      const result = await preview(value.kind)
      if (result === 'failed') throw new Error('Windows rejected the test notification')
      json(res, { ok: true })
    })
    add('/dsh-notifications/focus', async (req, res) => {
      if (req.method !== 'POST') { res.writeHead(405).end(); return }
      const value = await body(req)
      if (typeof value.id !== 'string' || value.id.length > 64 || typeof value.focused !== 'boolean') throw new Error('Invalid focus report')
      const now = Date.now()
      for (const [id, time] of clients) if (now - time > 10000) clients.delete(id)
      if (value.focused) clients.set(value.id, now)
      else clients.delete(value.id)
      res.writeHead(204).end()
    })
  })
}
