/** Pure text formatting for the three Windows notification text rows. */
import { win32 } from 'node:path'
import { createHash } from 'node:crypto'

/** Collapse whitespace and cap a Windows notification text field. */
export function compact(value, limit) {
  return value.replace(/\s+/gu, ' ').trim().slice(0, limit)
}

/** Keep only visible message text; reasoning and tool arguments are excluded. */
export function messageText(message) {
  return message.content.filter(block => block.type === 'text').map(block => block.text).join(' ')
}

/** Use the current conversation name, falling back to its durable session id. */
export function notification(session, title, detail, kind) {
  return {
    title: compact(title || session.id, 120),
    project: compact(session.header.cwd ? win32.basename(session.header.cwd.replace(/[\\/]+$/u, '')) || session.header.cwd : '未指定项目', 100),
    detail: compact(detail, 280),
    tag: createHash('sha256').update(`${session.id}:${kind}`).digest('hex').slice(0, 16),
  }
}
