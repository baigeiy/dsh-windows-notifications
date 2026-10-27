/** Keep notification click receipts valid across a normal dsh restart. */
import { existsSync, readFileSync, writeFileSync, renameSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const path = join(dirname(fileURLToPath(import.meta.url)), 'receipts.json')

export class ReceiptStore extends Map {
  constructor(reportError) {
    super()
    this.reportError = reportError
    if (existsSync(path)) {
      const entries = JSON.parse(readFileSync(path, 'utf8'))
      if (!Array.isArray(entries)) throw new Error('Invalid notification receipts')
      for (const [token, value] of entries) {
        if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/u.test(token) || typeof value?.tag !== 'string' || !/^[a-f0-9]{16}$/u.test(value.tag) || !Number.isSafeInteger(value.time)) throw new Error('Invalid notification receipt')
        if (Date.now() - value.time <= 86400000) super.set(token, value)
      }
    }
  }
  persist() {
    try {
      writeFileSync(`${path}.tmp`, `${JSON.stringify([...this])}\n`)
      renameSync(`${path}.tmp`, path)
    } catch (error) { this.reportError(error) }
  }
  set(key, value) { super.set(key, value); this.persist(); return this }
  delete(key) { const removed = super.delete(key); if (removed) this.persist(); return removed }
}
