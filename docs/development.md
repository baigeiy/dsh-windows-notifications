# 开发与维护

本页介绍插件的运行组成、本机数据和验证方式。安装与常用设置见[项目首页](../README.md)。

各源码、配置、资源和验证脚本的用途见[文件说明](files.md)。

## 运行方式

监听器运行在 dsh 的 Node 进程中；发送通知和处理点击时短暂启动辅助程序，没有独立常驻 Python 服务。网页聚焦时每 3 秒报告本机焦点状态。插件只提醒根会话，跳过子代理完成、取消和失败。

Host 入口是 [`index-v5.mjs`](../index-v5.mjs)，客户端入口是 [`client.js`](../client.js)，bundle 由 [`cordis.patch.yml`](../cordis.patch.yml) 声明。原生点击激活参考 [Toasty 的专属协议方案](https://github.com/shanselman/toasty/blob/main/DEVELOPMENT.md#click-to-focus-feature)，优先按窗口标题激活当前显示 DSH 的浏览器窗口；查找其他标签或需要焦点回退时才加载 Windows UI Automation。点击和清除程序直接读取共享标识符，避免加载通知身份注册与图片组件。

`settings.json` 中的 `openDshOnClick` 对应「点击通知打开 DSH」，默认 `true`；旧设置未包含此字段时仍启用。通知生成和点击激活都检查此开关，关闭后仅保留通知收起操作。用户操作及旧通知的行为见[使用说明](../README.md#使用说明)。

Windows 拒绝直接激活窗口时，插件会改为查找并选择实际的 DSH 标签；正常点击不搜索中转页，也不绑定不同程序的输入线程。

切回后会调用 `FlashWindowEx` 的 `FLASHW_STOP` 尝试清除目标窗口的任务栏提醒高亮。Windows 对协议激活进程的前台权限有限制，页面显示出来不一定表示已经取得前台焦点，任务栏高亮在部分系统上仍可能保留。

Edge 已实测；代码包含 Chrome、Firefox、Brave、Vivaldi、Opera 的窗口识别，但这些浏览器未逐一实机验证。多个 dsh 标签页同时打开时优先已有窗口当前显示的 DSH 页面，否则选择首个匹配标签，不定位到发通知的具体会话；浏览器标题或辅助功能结构变化可能影响识别。

## 本机数据和卸载

偏好、上传图片、通知收据、解压后的运行环境和日志保存在安装目录。发行包包含运行环境压缩包，不包含本机偏好、收据或日志。点击收据只能处理对应通知和返回 dsh，24 小时过期，不能读取对话或审批操作。初始化会注册本插件专属的 HKCU/HKLM 协议；处理程序只接受严格校验的通知参数。

停用或移除 dsh 包保留系统协议，以便旧通知仍可识别。彻底卸载前先清空通知，再核对命令指向本插件，移除 HKCU 与 HKLM 的 `Software/Classes/dsh-local-notification`、HKCU 的 `Software/DSHNotifications`、`Software/Classes/Applications/dsh-notification-activate.exe`、`Software/Classes/AppUserModelId/DeepSeekHarness.Notifications`、`Software/RegisteredApplications` 中本插件的 `DeepSeek Harness Notifications` 值及开始菜单的 `DSH Notifications` 快捷方式目录。

## 验证

初始化完成后，在插件目录运行：

```powershell
.\runtime\python.exe check-activation.py
.\runtime\python.exe check-reuse.py
.\runtime\python.exe check-focus.py
.\runtime\python.exe check-image.py
.\runtime\python.exe check-protocol.py
```

前三项模拟原生操作，`check-image.py` 检查图片 URI，并调用 Windows URL 读取器打开中文及特殊字符路径下的临时图片；最后一项只读检查 Windows 协议支持。实际问答、完成通知和点击行为已在本机 dsh Web / Edge 验证；其他宿主版本需先使用测试通知检查。

源码仓库另有 `node check-open.mjs` 和 `node check-client-v4.mjs`，分别验证打开开关的完整调用链及两种设置页面。这两项使用独立偏好与模拟通知，不修改本机设置，也不操作浏览器窗口；需要已安装依赖并构建的 DSH checkout，默认使用插件目录的上级目录，其他位置可通过 `DSH_CHECKOUT` 环境变量指定。

## 维护者构建与发布

以下命令供维护者使用，普通用户安装发行包不需要执行。构建运行环境需要 [uv](https://docs.astral.sh/uv/) 和 Windows 自带的 .NET Framework C# 编译器：

```powershell
powershell -File .\build-runtime.ps1
powershell -File .\check-distribution.ps1
powershell -File .\build-release.ps1
```

构建脚本下载 Python 3.13.17 官方嵌入包并核对 SHA-256，通过 `requirements.lock` 的哈希安装 wheel；缓存和临时构建文件保存在 `build/`。分发检查在隔离目录中验证打包和初始化流程，不进行系统注册。发布脚本需要 pnpm，生成 `dist/` 下的 `.tgz`、ZIP 和 `SHA256SUMS.txt`。

[DSH 官方插件发布教程](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.zh.md)介绍 Git 安装和预构建 tarball 的区别。
