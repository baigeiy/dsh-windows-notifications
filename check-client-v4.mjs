/** Check the native settings form using React and a DOM, with the shared controls represented by their public props. */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
const harnessRoot = resolve(process.env.DSH_CHECKOUT ?? join(dirname(fileURLToPath(import.meta.url)), '..'))
const harnessRequire = createRequire(join(harnessRoot, 'package.json'))
const { JSDOM } = harnessRequire('jsdom')
const require = createRequire(join(harnessRoot, 'packages/client/ui-settings-general/package.json'))
const React = require('react')
const {act} = React
const dom = new JSDOM('<!doctype html><head></head><body><div id="root"></div></body>',{url:'http://127.0.0.1:3080/'})
globalThis.window = dom.window
globalThis.document = dom.window.document
globalThis.IS_REACT_ACT_ENVIRONMENT = true
const {createRoot} = require('react-dom/client')
const h = React.createElement
const primitives = {
  SettingsForm:props=>h('div',null,props.children,h('button',{onClick:props.onSave},props.labels.save)),
  Switch:props=>h('button',{role:'switch','aria-label':props.label,'aria-checked':props.checked,onClick:()=>props.onChange(!props.checked)}),
  Input:props=>h('input',props),
  Button:({variant,size,children,...props})=>h('button',props,children),
  Menu:props=>h('div',null,props.anchor,props.open&&h('div',{role:'menu'},props.items.map(item=>h('button',{key:item.id,role:'menuitem',onClick:()=>props.onSelect(item.id)},item.label)))),
  StateDot:()=>h('span',null,'loading'),IconChevronDownOutlineRegular:()=>h('svg'),
}
const preferences={notifyWhenFocused:false,appName:'DeepSeek Harness',appIcon:'official',notificationIcon:'whale',questionTitle:'大肥鱼问你话呢',approvalTitle:'大肥鱼问你话呢',completionTitle:'干完了喵'}
let stored={...preferences}
const saved=[]
let definition
vm.runInNewContext(readFileSync(new URL('./client.js',import.meta.url),'utf8'),{
  window:{__ModuleLoader__:{load:value=>{definition=value}}},document:dom.window.document,AbortController,
  fetch:async(path,options={})=>{
    if(options.method==='POST'){
      const value=JSON.parse(options.body)
      saved.push(value)
      stored={...stored,...value}
    }
    return new Response(JSON.stringify(stored))
  },
})
const plugin=definition.factory(name=>name==='@deepseek-ai/dsh-client-ui-primitives'?primitives:require(name))
let registration,Component,dictionary
const disposers=[]
const ctx={effect(setup){disposers.push(setup())},locale:{register(ns,value){dictionary=value;return()=>{}},bind:()=>key=>dictionary.zh[key]},slots:{inject(slot,setup){assert.equal(slot,'settings.section');disposers.push(setup())},register(options,component){registration=options;Component=component;return()=>{registration=null}}}}
plugin.apply(ctx)
assert.equal(registration.label(),'Windows 通知')
const root=createRoot(document.getElementById('root'))
await act(async()=>{root.render(h(Component,{t:key=>dictionary.zh[key]}))})
assert.equal(document.querySelector('iframe'),null)
const ack=document.querySelector('.dn-preview-ack')
assert.equal(ack.tagName,'SPAN')
assert.equal(dom.window.getComputedStyle(ack).cursor,'default')
const openSwitch=document.querySelector('button[aria-label="点击通知打开 DSH"]')
assert.equal(openSwitch.getAttribute('aria-checked'),'true')
assert.equal(document.querySelector('.dn-preview-open').tagName,'SPAN')
assert.equal(dom.window.getComputedStyle(document.querySelector('.dn-preview-open')).cursor,'default')
assert.match(document.querySelector('.dn-preview-note').textContent,/点击正文或“打开 dsh”/u)
const saveButton=()=>[...document.querySelectorAll('button')].find(button=>button.textContent==='保存设置')
await act(async()=>openSwitch.click())
assert.equal(openSwitch.getAttribute('aria-checked'),'false')
assert.equal(document.querySelector('.dn-preview-open'),null)
assert.match(document.querySelector('.dn-preview-note').textContent,/只收起，不打开或切换浏览器/u)
await act(async()=>saveButton().click())
assert.equal(saved.at(-1).openDshOnClick,false)
assert.equal(saved.at(-1).notifyWhenFocused,false)
await act(async()=>openSwitch.click())
assert.equal(openSwitch.getAttribute('aria-checked'),'true')
assert.notEqual(document.querySelector('.dn-preview-open'),null)
await act(async()=>saveButton().click())
assert.equal(saved.at(-1).openDshOnClick,true)
await act(async()=>document.querySelector('button[aria-label="显示应用图标"]').click())
const choices=[...document.querySelectorAll('[role=menuitem]')].map(item=>item.textContent)
assert.deepEqual(choices,['官方','大肥鱼','自定义图片'])
assert.equal(document.querySelector('input[aria-label="显示应用名字"]').value,'DeepSeek Harness')
await act(async()=>root.unmount())
for(const dispose of disposers.reverse())dispose()
assert.equal(document.querySelector('style'),null)
assert.equal(registration,null)
dom.window.close()

const standalone=new JSDOM(readFileSync(new URL('./settings-v3.html',import.meta.url),'utf8'),{url:'http://127.0.0.1:3080/dsh-notifications',runScripts:'outside-only'})
let standaloneStored={...preferences}
const standaloneSaved=[]
standalone.window.fetch=async(path,options={})=>{
  if(options.method==='POST'){
    const value=JSON.parse(options.body)
    standaloneSaved.push(value)
    standaloneStored={...standaloneStored,...value}
  }
  return new Response(JSON.stringify(standaloneStored))
}
const standaloneDocument=standalone.window.document
const waitForStatus=pattern=>new Promise((resolve,reject)=>{
  const status=standaloneDocument.getElementById('status')
  const observer=new standalone.window.MutationObserver(()=>{
    if(pattern.test(status.textContent)){observer.disconnect();clearTimeout(timer);resolve()}
  })
  const timer=setTimeout(()=>{observer.disconnect();reject(new Error(`Standalone settings state: ${status.textContent}`))},1000)
  observer.observe(status,{subtree:true,childList:true,characterData:true})
})
try{
  const loaded=waitForStatus(/设置已加载/u)
  standalone.window.eval(readFileSync(new URL('./settings.js',import.meta.url),'utf8'))
  await loaded
  const toggle=standaloneDocument.getElementById('openDshOnClick')
  assert.equal(toggle.checked,true)
  assert.equal(standaloneDocument.getElementById('openPreview').hidden,false)
  assert.equal(standaloneDocument.getElementById('openPreview').disabled,true)
  const change=async value=>{
    toggle.checked=value
    toggle.dispatchEvent(new standalone.window.Event('input',{bubbles:true}))
    const completed=waitForStatus(/已保存/u)
    standaloneDocument.getElementById('form').dispatchEvent(new standalone.window.Event('submit',{cancelable:true}))
    await completed
  }
  await change(false)
  assert.equal(standaloneSaved.at(-1).openDshOnClick,false)
  assert.equal(standaloneDocument.getElementById('openPreview').hidden,true)
  assert.match(standaloneDocument.getElementById('previewNote').textContent,/只收起，不打开或切换浏览器/u)
  await change(true)
  assert.equal(standaloneSaved.at(-1).openDshOnClick,true)
  assert.equal(standaloneDocument.getElementById('openPreview').hidden,false)
  assert.match(standaloneDocument.getElementById('previewNote').textContent,/点击正文或“打开 dsh”/u)
}finally{standalone.window.close()}
console.log('PASS: native and standalone settings preserve old defaults, save the click-to-open switch, update previews, keep focus independent, and dispose without local preference writes')
