/** Notification appearance form; values and uploaded images stay on the local dsh Host. */
(() => {
  const keys = ['notifyWhenFocused', 'openDshOnClick', 'appName', 'appIcon', 'notificationIcon', 'questionTitle', 'approvalTitle', 'completionTitle']
  const booleanKeys = new Set(['notifyWhenFocused', 'openDshOnClick'])
  const el = id => document.getElementById(id)
  const status = (text, error = false) => { el('status').textContent = text; el('status').className = error ? 'error' : '' }
  const values = () => Object.fromEntries(keys.map(key => [key, booleanKeys.has(key) ? el(key).checked : el(key).value]))
  const apply = value => { const preferences = {openDshOnClick:true,...value}; for (const key of keys) if (booleanKeys.has(key)) el(key).checked = preferences[key]; else el(key).value = preferences[key]; render() }
  const icon = (role, choice) => `/dsh-notifications/icon?role=${role}&choice=${choice}&v=${Date.now()}`
  const render = () => {
    const value = values()
    const app = icon('app', value.appIcon)
    const notification = icon('notification', value.notificationIcon)
    el('appPreview').src = el('sourcePreview').src = app
    el('notificationPreview').src = el('bodyPreview').src = notification
    el('sourceName').textContent = value.appName
    el('titlePreview').textContent = value[el('previewKind').value === 'completed' ? 'completionTitle' : 'questionTitle']
    el('openPreview').hidden = !value.openDshOnClick
    el('previewNote').textContent = value.openDshOnClick
      ? '预览不可点击。“确认收到”只收起通知；点击正文或“打开 dsh”会切换到已打开的页面。'
      : '预览不可点击。实际通知只收起，不打开或切换浏览器。'
  }
  const api = async (path, value) => {
    const response = await fetch(`/dsh-notifications/${path}`, value === undefined ? {} : {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(value),
    })
    if (!response.ok) throw new Error(response.status === 401 ? '请先在同一浏览器打开并连接 dsh。' : '操作失败。请检查输入和图片后重试。')
    return response.json()
  }
  async function save() {
    if (!el('form').reportValidity()) throw new Error('请填写完整的应用名字和提示标题。')
    apply(await api('preferences', values()))
    status('已保存，立即生效。')
  }
  async function busy(action) {
    el('fields').disabled = true
    try { await action() } catch (error) { status(error.message, true) }
    finally { el('fields').disabled = false }
  }
  el('form').addEventListener('input', render)
  el('previewKind').addEventListener('change', render)
  el('form').addEventListener('submit', event => { event.preventDefault(); void busy(save) })
  el('test').addEventListener('click', () => { void busy(async () => { await save(); await api('preview', { kind: el('previewKind').value }); status('测试通知已发送。可点击“确认收到”验证收回。') }) })
  el('reset').addEventListener('click', () => { void busy(async () => { apply(await api('preferences?defaults=1')); status('已恢复默认预览，点击保存后生效。') }) })
  for (const role of ['app', 'notification']) el(`${role}Upload`).addEventListener('change', event => {
    const file = event.target.files[0]
    if (!file) return
    void busy(async () => {
      if (file.size > 4 * 1024 * 1024) throw new Error('图片不能超过 4 MB。')
      status('正在上传图片…')
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result).split(',')[1])
        reader.onerror = () => reject(new Error('无法读取图片，请重试。'))
        reader.readAsDataURL(file)
      })
      await api('upload', { role, data })
      el(role === 'app' ? 'appIcon' : 'notificationIcon').value = 'custom'
      render()
      status('图片已上传，点击保存后用于通知。')
    })
  })
  if (new URLSearchParams(location.search).has('embedded')) el('footer').hidden = true
  api('preferences').then(value => { apply(value); el('fields').disabled = false; status('设置已加载。') }).catch(error => status(error.message, true))
})()
