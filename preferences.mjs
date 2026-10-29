/** Persist local notification appearance, focus and click preferences. */
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const file = join(dirname(fileURLToPath(import.meta.url)), 'settings.json')
export const DEFAULTS = Object.freeze({
  notifyWhenFocused: false, openDshOnClick: true, appName: 'DeepSeek Harness', appIcon: 'official', notificationIcon: 'whale',
  questionTitle: '大肥鱼问你话呢', approvalTitle: '大肥鱼问你话呢', completionTitle: '干完了喵',
})

function validate(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected notification preferences')
  for (const key of Object.keys(value)) if (!Object.hasOwn(DEFAULTS, key)) throw new Error(`Unknown notification preference: ${key}`)
  const next = { ...DEFAULTS, ...value }
  if (typeof next.notifyWhenFocused !== 'boolean') throw new Error('notifyWhenFocused must be a boolean')
  if (typeof next.openDshOnClick !== 'boolean') throw new Error('openDshOnClick must be a boolean')
  for (const key of ['appName', 'questionTitle', 'approvalTitle', 'completionTitle']) {
    if (typeof next[key] !== 'string' || !next[key].trim() || next[key].length > (key === 'appName' ? 64 : 100) || /[\u0000-\u001f]/u.test(next[key])) throw new Error(`Invalid ${key}`)
    next[key] = next[key].trim()
  }
  for (const key of ['appIcon', 'notificationIcon']) {
    if (!['official', 'whale', 'custom'].includes(next[key])) throw new Error(`Invalid ${key}`)
    if (next[key] === 'custom' && !existsSync(join(dirname(file), `custom-${key === 'appIcon' ? 'app' : 'notification'}.png`))) throw new Error('Upload an icon before selecting custom')
  }
  return next
}

export function readPreferences() {
  return validate(existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {})
}

export function writePreferences(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected notification preferences')
  const next = validate({ ...readPreferences(), ...value })
  writeFileSync(`${file}.tmp`, `${JSON.stringify(next, null, 2)}\n`)
  renameSync(`${file}.tmp`, file)
  return next
}
