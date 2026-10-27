/** Report focus only; no conversation text or user input leaves this document. */
(() => {
  const id = crypto.randomUUID()
  const controller = new AbortController()
  const report = (closing = false) => {
    fetch('/dsh-notifications/focus', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, focused: !closing && document.visibilityState === 'visible' && document.hasFocus() }),
      keepalive: true }).catch(error => console.debug('dsh notification focus report unavailable', error))
  }
  for (const name of ['focus', 'blur', 'pageshow']) window.addEventListener(name, () => report(), { signal: controller.signal })
  document.addEventListener('visibilitychange', () => report(), { signal: controller.signal })
  const heartbeat = setInterval(() => { if (document.hasFocus()) report() }, 3000)
  window.addEventListener('pagehide', event => {
    report(true)
    if (!event.persisted) { clearInterval(heartbeat); controller.abort() }
  })
  report()
})()
