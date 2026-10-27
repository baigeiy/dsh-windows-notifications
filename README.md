# dsh-windows-notifications

给 DeepSeek Harness Web 加上 Windows 原生通知：需要你回答时叫你一声，完成后再提醒你回来。

## 功能

- 提问与操作确认默认显示「大肥鱼问你话呢」，本轮完成显示「干完了喵」。
- 点击正文或「打开 dsh」直接选择已有 dsh 标签页，不创建中转网页；没有打开时才新开页面。
- 「确认收到」使用系统收起动作，同时移除通知，不代替回答或批准操作。
- 聚焦时默认免打扰，提供独立开关。
- 自定义应用来源名字、来源图标、提示图标和三个标题；内置「官方」「大肥鱼」，支持透明图片。
- 插件市场的已安装列表可启用/停用；停用时解绑监听并移除设置页。

![插件设置](docs/settings.png)

## 安装

适用于 Windows 10/11 上的 dsh Web。需要 dsh、[uv](https://docs.astral.sh/uv/) 和 Windows 自带的 .NET Framework C# 编译器。首次原生初始化需要管理员 PowerShell；插件安装不会自动执行管理员脚本。

推荐克隆到长期保留的目录，再按本地链接安装：

```powershell
git clone https://github.com/baigeiy/dsh-windows-notifications.git
cd dsh-windows-notifications
# 管理员 PowerShell 中运行一次
powershell -File .\setup.ps1
# 在平时使用 dsh 的终端安装
dsh plugin --profile web add "link:$((Get-Location).Path)"
```

重启 dsh Web 并刷新页面。在 **设置 → Windows 通知** 点击「保存并发送测试」，在 **插件市场 → 已安装** 启用或停用。

也可使用 `dsh plugin --profile web add github:baigeiy/dsh-windows-notifications`，但仍须在安装后的插件目录运行 `setup.ps1`。包管理器更新可能更换目录，更新后需要重新初始化原生环境；本地链接更便于保留设置和依赖。

## 设置

| 选项 | 默认值 |
| --- | --- |
| 聚焦时也弹出通知 | 关闭 |
| 显示应用名字 | DeepSeek Harness |
| 显示应用图标 | 官方 |
| 提示图标 | 大肥鱼 |
| 提问/操作确认标题 | 大肥鱼问你话呢 |
| 对话结束标题 | 干完了喵 |

图片支持 PNG、JPEG、WebP、ICO，最大 4 MiB、最长边 4096 像素。保存立即生效。测试通知临时忽略聚焦状态。系统声音、权限和勿扰设置仍适用。

默认服务为 `http://127.0.0.1:3080/`。使用其他端口时，在 web profile 的 `cordis.patch.yml` 中覆盖完整配置：

```yaml
- id: local-windows-notifications
  config:
    baseUrl: http://127.0.0.1:3081/
    timeoutMs: 15000
```

## 运行方式与限制

监听在 dsh 的 Node 进程中运行；发送和处理点击时短暂启动辅助程序，没有独立常驻 Python 服务。网页聚焦时每 3 秒报告本机焦点状态。只提醒根会话，跳过子代理完成、取消和失败。

点击激活参考 [Toasty 的专属协议方案](https://github.com/shanselman/toasty/blob/main/DEVELOPMENT.md#click-to-focus-feature)，用 Windows UI Automation 按产品标题选择标签页。Edge 已实测；代码包含 Chrome、Firefox、Brave、Vivaldi、Opera 的窗口识别，但未逐一实机验证。多个 dsh 标签页同时打开时选择第一个匹配页面，目前不定位到发通知的具体会话。标题或浏览器辅助功能结构变化可能影响识别。

这是社区插件，非官方出品。代码采用 [MIT](LICENSE) 许可证，图片和商标说明见 [NOTICE.md](NOTICE.md)。

## 本机数据

偏好、上传图片、通知收据、运行环境和日志保存在安装目录，不进入 Git 仓库或发行包。点击收据只能处理对应通知和返回 dsh，24 小时过期，不能读取对话或审批操作。首次初始化注册本插件专属的 HKCU/HKLM 协议；处理程序只接受严格校验的通知参数。

停用或移除 dsh 包保留系统协议，以便旧通知仍可识别。彻底卸载前先清空通知，再核对命令指向本插件，移除 HKCU 与 HKLM 的 `Software/Classes/dsh-local-notification`、HKCU 的 `Software/DSHNotifications`、`Software/Classes/Applications/dsh-notification-activate.exe`、`Software/Classes/AppUserModelId/DeepSeekHarness.Notifications`、`Software/RegisteredApplications` 中本插件的 `DeepSeek Harness Notifications` 值及开始菜单的 `DSH Notifications` 快捷方式目录。

## 开发验证

Host 入口为 `index-v5.mjs`，客户端为 `client.js`，bundle 由 `cordis.patch.yml` 声明。修改原生启动器后重新运行 setup。

```powershell
.\.venv\Scripts\python.exe check-activation.py
.\.venv\Scripts\python.exe check-reuse.py
.\.venv\Scripts\python.exe check-focus.py
.\.venv\Scripts\python.exe check-protocol.py
```

前三项模拟原生操作，最后一项只读检查 Windows 协议支持。实际问答、完成通知和点击行为已在本机 dsh Web / Edge 验证；其他宿主版本需先使用测试通知检查。
