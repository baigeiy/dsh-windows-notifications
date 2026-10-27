window.__ModuleLoader__.load({
  id: 'dsh-windows-notifications',
  factory: require => {
    const React = require('react')
    const { SettingsForm, Switch, Input, Button, Menu, StateDot, IconChevronDownOutlineRegular } = require('@deepseek-ai/dsh-client-ui-primitives')
    const h = React.createElement
    const keys = ['notifyWhenFocused', 'appName', 'appIcon', 'notificationIcon', 'questionTitle', 'approvalTitle', 'completionTitle']
    const zh = { nav:'Windows 通知',focus:'聚焦时也弹出通知',focusDesc:'关闭时，正在看 dsh 不提醒；切走或最小化后提醒',appName:'显示应用名字',appNameDesc:'通知顶部显示的应用来源',appIcon:'显示应用图标',bodyIcon:'提示图标',upload:'上传图片',imageDesc:'支持透明 PNG、JPEG、WebP、ICO；不超过 4 MB',official:'官方',whale:'大肥鱼',custom:'自定义图片',question:'提问标题',approval:'操作确认标题',completion:'对话结束标题',preview:'通知预览',questionKind:'提问通知',completedKind:'对话完成通知',sample:'这里显示 dsh 的问题或本轮完成提示',ack:'确认收到',ackDesc:'预览不可点击。实际通知中的“确认收到”只收起通知；打开 dsh 会切换到已打开的页面',save:'保存设置',saving:'正在保存',test:'保存并发送测试',reset:'恢复默认预览',saved:'已保存，立即生效',sent:'测试通知已发送',resetDone:'已恢复默认预览，保存后生效',uploadDone:'图片已上传，保存后生效',failed:'保存失败，已保留修改，请重试',invalid:'请填写完整的应用名字和提示标题',loadFailed:'无法读取通知设置',retry:'重试',loading:'正在读取设置',unavailable:'通知设置不可用',readOnly:'设置只读',fileLarge:'图片不能超过 4 MB',fileError:'无法读取图片',requestError:'操作失败，请检查输入和图片后重试',authError:'请重新连接 dsh 后重试',testDesc:'测试通知临时忽略聚焦状态'}
    const css = `
.dsh-notify{width:100%;min-width:0;container-type:inline-size;color:var(--dsw-alias-label-primary);font:inherit}
.dsh-notify .dn-row{display:flex;align-items:center;gap:16px;padding:16px 0;border-bottom:.5px solid var(--dsw-alias-border-l2)}
.dsh-notify .dn-copy{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}.dsh-notify .dn-title{font-size:14px;font-weight:400;line-height:22px}.dsh-notify .dn-desc{font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)}
.dsh-notify .dn-control{flex:0 1 280px;min-width:0;max-width:100%}.dsh-notify .dn-control>span{width:100%}.dsh-notify .dn-control input{font-size:14px}.dsh-notify .dn-toggle{flex:none}
.dsh-notify .dn-selector{display:inline-flex;align-items:center;justify-content:space-between;gap:12px;min-width:104px;max-width:100%;height:36px;padding:0 14px;border:none;border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-module-platform);font:inherit;font-size:14px;line-height:22px;color:var(--dsw-alias-label-primary);cursor:pointer}.dsh-notify .dn-selector:disabled{cursor:default;opacity:.5}.dsh-notify .dn-selector svg{flex:none;width:16px;height:16px}
.dsh-notify .dn-icon-control{display:flex;align-items:center;justify-content:flex-end;gap:10px;flex-wrap:wrap}.dsh-notify .dn-icon{width:36px;height:36px;object-fit:contain;flex:none}.dsh-notify .dn-upload{width:100%;display:flex;justify-content:flex-end;gap:8px;align-items:center}.dsh-notify .dn-file{width:1px;height:1px;position:absolute;opacity:0;pointer-events:none}
.dsh-notify .dn-preview-group{padding:16px 0;border-bottom:.5px solid var(--dsw-alias-border-l2)}.dsh-notify .dn-preview-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}.dsh-notify .dn-preview{padding:16px;border:.5px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-module-platform)}.dsh-notify .dn-source{display:flex;gap:8px;align-items:center;font-size:12px;margin-bottom:12px}.dsh-notify .dn-source img{width:20px;height:20px;object-fit:contain}.dsh-notify .dn-toast{display:flex;gap:12px}.dsh-notify .dn-toast>img{width:48px;height:48px;object-fit:contain}.dsh-notify .dn-toast>div{min-width:0;overflow-wrap:anywhere}.dsh-notify .dn-toast-title{font-weight:500;font-size:14px;line-height:22px}.dsh-notify .dn-preview-ack{display:inline-flex;align-items:center;min-height:28px;border-radius:var(--dsw-radius-sm);padding:0 12px;margin-top:12px;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-secondary);font-size:13px;cursor:default;user-select:none}.dsh-notify .dn-preview-note{margin-top:10px}
.dsh-notify .dn-extra{display:flex;gap:8px;flex-wrap:wrap;padding-top:16px}.dsh-notify .dn-status{min-height:22px;padding-top:12px;font-size:12px;color:var(--dsw-alias-label-tertiary)}.dsh-notify .dn-error{color:var(--dsw-alias-label-error)}.dsh-notify .dn-loading{display:flex;min-height:160px;align-items:center;justify-content:center}
@media(hover:hover){.dsh-notify .dn-selector:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}}
@container(max-width:480px){.dsh-notify .dn-row:not(.dn-switch-row){flex-wrap:wrap}.dsh-notify .dn-row:not(.dn-switch-row) .dn-copy{flex-basis:100%}.dsh-notify .dn-control{flex-basis:100%;width:100%}.dsh-notify .dn-icon-control{justify-content:flex-start}.dsh-notify .dn-upload{justify-content:flex-start}.dsh-notify .dn-preview-head{align-items:flex-start;flex-wrap:wrap}}
`
    const api = async (path, value, signal) => {
      const response = await fetch(`/dsh-notifications/${path}`, value === undefined ? {signal} : {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(value),signal})
      if (!response.ok) throw new Error(response.status === 401 ? zh.authError : zh.requestError)
      return response.json()
    }
    function Select({ label, value, options, onChange, disabled }) {
      const [open,setOpen] = React.useState(false)
      return h(Menu,{open,onClose:()=>setOpen(false),items:options,selectedId:value,onSelect:id=>{setOpen(false);onChange(id)},align:'end',portal:true,
        anchor:h('button',{type:'button',className:'dn-selector','aria-label':label,'aria-haspopup':'menu','aria-expanded':open,disabled,onClick:()=>setOpen(v=>!v)},options.find(option=>option.id===value)?.label,h(IconChevronDownOutlineRegular))})
    }
    function Row({title,description,children,toggle=false}) {
      return h('div',{className:`dn-row${toggle?' dn-switch-row':''}`},h('div',{className:'dn-copy'},h('div',{className:'dn-title'},title),description&&h('div',{className:'dn-desc'},description)),h('div',{className:toggle?'dn-toggle':'dn-control'},children))
    }
    function NotificationSettings({t}) {
      const [draft,setDraft] = React.useState(null)
      const [saved,setSaved] = React.useState(null)
      const [busy,setBusy] = React.useState(false)
      const [message,setMessage] = React.useState('')
      const [failed,setFailed] = React.useState(false)
      const [kind,setKind] = React.useState('question')
      const [imageVersion,setImageVersion] = React.useState(0)
      const appUpload = React.useRef(null)
      const notificationUpload = React.useRef(null)
      const load = () => api('preferences').then(value=>{setDraft(value);setSaved(value);setFailed(false);setMessage('')}).catch(()=>{setFailed(true);setMessage(t('loadFailed'))})
      React.useEffect(()=>{const controller=new AbortController();api('preferences',undefined,controller.signal).then(value=>{setDraft(value);setSaved(value)}).catch(error=>{if(error.name!=='AbortError'){setFailed(true);setMessage(t('loadFailed'))}});return()=>controller.abort()},[])
      const edit = (key,value) => {setDraft(current=>({...current,[key]:value}));setFailed(false);setMessage('')}
      const run = async operation => {setBusy(true);setFailed(false);try{await operation()}catch(error){setFailed(true);setMessage(error.message)}finally{setBusy(false)}}
      const save = async () => {const value=await api('preferences',draft);setDraft(value);setSaved(value);setMessage(t('saved'))}
      const upload = async (role,file) => {
        if (!file) return
        await run(async()=>{
          if(file.size>4*1024*1024)throw Error(t('fileLarge'))
          const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(Error(t('fileError')));reader.readAsDataURL(file)})
          await api('upload',{role,data});edit(role==='app'?'appIcon':'notificationIcon','custom');setImageVersion(v=>v+1);setMessage(t('uploadDone'))
        })
      }
      if(!draft)return h('div',{className:'dsh-notify'},failed?h('div',{role:'status',className:'dn-error'},message,h(Button,{onClick:load},t('retry'))):h('div',{className:'dn-loading','aria-label':t('loading')},h(StateDot,{state:'ongoing'})))
      const invalid=['appName','questionTitle','approvalTitle','completionTitle'].some(key=>!draft[key].trim()||draft[key].length>(key==='appName'?64:100))
      const options=['official','whale','custom'].map(id=>({id,label:t(id)}))
      const icon=(role,choice)=>`/dsh-notifications/icon?role=${role}&choice=${choice}&v=${imageVersion}`
      const textRow=(key,title,description)=>h(Row,{key,title:t(title),description:description&&t(description)},h(Input,{'aria-label':t(title),value:draft[key],maxLength:key==='appName'?64:100,disabled:busy,onChange:event=>edit(key,event.target.value)}))
      const iconRow=role=>h(Row,{key:role,title:t(role==='app'?'appIcon':'bodyIcon'),description:t('imageDesc')},h('div',{className:'dn-icon-control'},h('img',{className:'dn-icon',src:icon(role,draft[role==='app'?'appIcon':'notificationIcon']),alt:''}),h(Select,{label:t(role==='app'?'appIcon':'bodyIcon'),value:draft[role==='app'?'appIcon':'notificationIcon'],options,disabled:busy,onChange:value=>edit(role==='app'?'appIcon':'notificationIcon',value)}),h('div',{className:'dn-upload'},h(Button,{size:'sm',disabled:busy,onClick:()=>{(role==='app'?appUpload:notificationUpload).current.click()}},t('upload')),h('input',{type:'file',className:'dn-file',ref:role==='app'?appUpload:notificationUpload,accept:'image/png,image/jpeg,image/webp,image/x-icon,.ico','aria-label':`${t('upload')} ${t(role==='app'?'appIcon':'bodyIcon')}`,disabled:busy,onChange:event=>{void upload(role,event.target.files[0])}}))))
      return h('div',{className:'dsh-notify'},h(SettingsForm,{
        labels:{unavailable:t('unavailable'),readOnly:t('readOnly'),saveFailed:t('failed'),save:t('save'),saving:t('saving')},
        state:{available:true,writable:true,dirty:JSON.stringify(draft)!==JSON.stringify(saved),invalid,saving:busy,failed},onSave:()=>{void run(save)},onDiscard:()=>{},
      },
      h(Row,{title:t('focus'),description:t('focusDesc'),toggle:true},h(Switch,{checked:draft.notifyWhenFocused,label:t('focus'),disabled:busy,onChange:value=>edit('notifyWhenFocused',value)})),
      textRow('appName','appName','appNameDesc'),iconRow('app'),textRow('questionTitle','question'),textRow('approvalTitle','approval'),textRow('completionTitle','completion'),iconRow('notification'),
      h('div',{className:'dn-preview-group'},h('div',{className:'dn-preview-head'},h('div',{className:'dn-title'},t('preview')),h(Select,{label:t('preview'),value:kind,disabled:busy,options:[{id:'question',label:t('questionKind')},{id:'completed',label:t('completedKind')}],onChange:setKind})),
      h('div',{className:'dn-preview'},h('div',{className:'dn-source'},h('img',{src:icon('app',draft.appIcon),alt:''}),draft.appName),h('div',{className:'dn-toast'},h('img',{src:icon('notification',draft.notificationIcon),alt:''}),h('div',null,h('div',{className:'dn-toast-title'},kind==='completed'?draft.completionTitle:draft.questionTitle),h('div',{className:'dn-desc'},t('sample')))),h('span',{className:'dn-preview-ack'},t('ack'))),h('div',{className:'dn-desc dn-preview-note'},t('ackDesc'))),
      h('div',{className:'dn-extra'},h(Button,{size:'sm',variant:'outline',disabled:busy||invalid,onClick:()=>{void run(async()=>{await save();await api('preview',{kind});setMessage(t('sent'))})}},t('test')),h(Button,{size:'sm',disabled:busy,onClick:()=>{void run(async()=>{setDraft(await api('preferences?defaults=1'));setMessage(t('resetDone'))})}},t('reset'))),
      h('div',{className:`dn-status${failed?' dn-error':''}`,role:'status','aria-live':'polite'},message||t('testDesc'))))
    }
    return {
      inject:['slots','locale'],
      apply(ctx){
        const ns='localWindowsNotifications'
        ctx.effect(()=>ctx.locale.register(ns,{zh,en:{...zh,nav:'Windows notifications'}}),'windows-notifications: settings locale')
        ctx.effect(()=>{const style=document.createElement('style');style.textContent=css;document.head.append(style);return()=>style.remove()},'windows-notifications: native settings styles')
        const t=ctx.locale.bind(ns)
        ctx.slots.inject('settings.section',()=>ctx.slots.register({name:'settings.section',id:'windows-notifications',order:65,locale:ns,label:()=>t('nav')},NotificationSettings))
      },
    }
  },
})
