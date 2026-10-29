# 开发与维护

本页介绍插件的运行组成、本机数据和验证方式。安装与常用设置见[项目首页](../README.md)。

各源码、配置、资源和验证脚本的用途见[文件说明](files.md)。

## 运行方式

监听器运行在 dsh 的 Node 进程中；发送通知和处理点击时短暂启动辅助程序，没有独立常驻 Python 服务。网页聚焦时每 3 秒报告本机焦点状态。插件只提醒根会话，跳过子代理完成、取消和失败。

Host 入口是 [`index-v5.mjs`](../index-v5.mjs)，客户端入口是 [`client.js`](../client.js)，bundle 由 [`cordis.patch.yml`](../cordis.patch.yml) 声明。原生点击激活参考 [Toasty 的专属协议方案](https://github.com/shanselman/toasty/blob/main/DEVELOPMENT.md#click-to-focus-feature)，通过 Windows UI Automation 寻找浏览器标签页。

Edge 已实测；代码包含 Chrome、Firefox、Brave、Vivaldi、Opera 的窗口识别，但这些浏览器未逐一实机验证。多个 dsh 标签页同时打开时选择第一个匹配页面，不定位到发通知的具体会话；浏览器标题或辅助功能结构变化可能影响识别。

## 本机数据和卸载

偏好、上传图片、通知收据、解压后的运行环境和日志保存在安装目录。发行包包含运行环境压缩包，不包含本机偏好、收据或日志。点击收据只能处理对应通知和返回 dsh，24 小时过期，不能读取对话或审批操作。初始化会注册本插件专属的 HKCU/HKLM 协议；处理程序只接受严格校验的通知参数。

停用或移除 dsh 包保留系统协议，以便旧通知仍可识别。彻底卸载前先清空通知，再核对命令指向本插件，移除 HKCU 与 HKLM 的 `Software/Classes/dsh-local-notification`、HKCU 的 `Software/DSHNotifications`、`Software/Classes/Applications/dsh-notification-activate.exe`、`Software/Classes/AppUserModelId/DeepSeekHarness.Notifications`、`Software/RegisteredApplications` 中本插件的 `DeepSeek Harness Notifications` 值及开始菜单的 `DSH Notifications` 快捷方式目录。

## 验证

初始化完成后，在插件目录运行：

```powershell
.\runtime\python.exe check-activation.py
.\runtime\python.exe check-reuse.py
.\runtime\python.exe check-focus.py
.\runtime\python.exe check-protocol.py
```

前三项模拟原生操作，最后一项只读检查 Windows 协议支持。实际问答、完成通知和点击行为已在本机 dsh Web / Edge 验证；其他宿主版本需先使用测试通知检查。

## 维护者构建与发布

以下命令供维护者使用，普通用户安装发行包不需要执行。构建运行环境需要 [uv](https://docs.astral.sh/uv/) 和 Windows 自带的 .NET Framework C# 编译器：

```powershell
powershell -File .\build-runtime.ps1
powershell -File .\check-distribution.ps1
powershell -File .\build-release.ps1
```

构建脚本下载 Python 3.13.17 官方嵌入包并核对 SHA-256，通过 `requirements.lock` 的哈希安装 wheel；缓存和临时构建文件保存在 `build/`。分发检查在隔离目录中验证打包和初始化流程，不进行系统注册。发布脚本需要 pnpm，生成 `dist/` 下的 `.tgz`、ZIP 和 `SHA256SUMS.txt`。

[DSH 官方插件发布教程](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.zh.md)介绍 Git 安装和预构建 tarball 的区别。
