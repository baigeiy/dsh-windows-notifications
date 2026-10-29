# DSH Windows 提示精简版

为 DeepSeek Harness 提供纯文字 Windows 原生通知。只有 DSH 不在前台时才提示；切到其他窗口、切到其他标签页或最小化后可以收到通知。

精简版位于本仓库的 [`codex/lite` 分支](https://github.com/baigeiy/dsh-windows-notifications/tree/codex/lite)，完整版保留在 [`main` 分支](https://github.com/baigeiy/dsh-windows-notifications/tree/main)。两个版本使用独立的插件包名和通知来源标识。

通知按三行排列：**文件夹名称 → 对话名称 → 详细信息**。文件夹名称取会话工作目录的最后一级文件夹名称；对话尚未生成名称时，第二行显示会话 ID。

| 触发场景 | 详细信息 |
| --- | --- |
| 主对话需要回答问题 | 问题的内容 |
| 主对话需要确认操作 | 操作确认说明 |
| 主对话正常完成 | 当前轮最后一条可见回复的文字摘要；没有文字时显示完成说明 |

应用来源显示原版样式的官方黑鲸鱼及 `DeepSeek Harness`，保留图标的浅色底板。通知正文保持纯文字，不包含正文图片、个性化标题、设置页面、打开浏览器按钮、网页中转或协议启动器。关闭按钮由 Windows 处理。子代理、已取消的问题、异常中断和仍在等回答的完成事件不会发出通知。详情最多 280 字符，Windows 可能进一步折叠显示。

## 使用

支持 Windows 10/11。已附带 `foreground.dll` 和通知身份程序，使用 Windows 自带的 PowerShell 5.1 和 .NET Framework，无需下载 Python、安装依赖、管理员权限或自行编译。

1. 下载 [精简版分支 ZIP](https://github.com/baigeiy/dsh-windows-notifications/archive/refs/heads/codex/lite.zip)，将其中包含 `package.json` 的插件目录解压到长期保留的 E 盘位置，例如 `E:\dsh-windows提示精简版`。请完整保留随附的 DLL、EXE 和图标文件。

2. 在平时启动 DSH 的终端运行以下命令；若使用其他目录，将路径替换为实际位置：

```powershell
dsh plugin --profile web add "link:E:/dsh-windows提示精简版"
```

3. 在插件的“已安装”列表中停用完整版，避免重复通知，再启用 `dsh-windows-notifications-lite` 并重启 DSH。

更新时将此分支的文件解压覆盖到同一个 E 盘目录，然后重启 DSH。这个本地链接始终指向该目录；完整版本的设置独立保留。

聚焦检测只读取 Windows 当前前台窗口的标题，识别 DSH 官方标题后缀，既不激活窗口，也不轮询浏览器。若修改 DSH 网页标题、使用隐藏产品标题的外壳或其他工具改写标题，可能无法识别聚焦状态。系统通知权限、勿扰模式和全屏规则仍由 Windows 控制。

空闲时没有常驻 Python、PowerShell 或独立服务；事件监听跟随 DSH 插件运行，每次发送时短暂启动一个隐藏的 PowerShell 进程，完成后退出。发送失败记录到 DSH 日志，不修改对话结果，也不自动重试。

## 系统登记与卸载

实际发送时，登记当前用户的 `HKCU\Software\Classes\AppUserModelId\DeepSeekHarness.Notifications.Lite`，名称为 `DeepSeek Harness`，来源图标指向本目录的 `sender-original.ico`。图标采用原版的官方黑鲸鱼样式。每次登记都使用当前目录，移动文件夹后无需另行修正图标路径。这是 Windows 管理的通知来源登记，使用独立 ID，不覆盖原版；不注册协议处理器、启动项或计划任务。

Windows 同时需要一个带相同 AppUserModelID 的开始菜单快捷方式，才能识别桌面应用的来源名称和图标。插件将它登记为 `%APPDATA%\Microsoft\Windows\Start Menu\Programs\DSH Windows Notifications Lite\DeepSeek Harness.lnk`；这是系统管理的位置。快捷方式指向 E 盘插件目录内的 `notification-identity.exe`，该程序立即退出，没有窗口和常驻进程，不打开 DSH 或浏览器。文件夹迁移后，下次通知会更新快捷方式的目标和图标路径。[Windows 桌面通知身份说明](https://learn.microsoft.com/en-us/windows/win32/shell/enable-desktop-toast-with-appusermodelid)。

在插件市场停用或移除精简版后，可运行 `powershell -NoProfile -ExecutionPolicy Bypass -File .\uninstall.ps1` 清除该来源登记、快捷方式及其历史通知。

## 文件与验证

| 文件 | 用途 |
| --- | --- |
| `index.mjs` | DSH 事件监听、发送子进程和停用清理 |
| `content.mjs` | 对话名称、项目名称和可见回复摘要格式化 |
| `notify.ps1` | 聚焦检查、来源登记、XML 转义和原生通知提交 |
| `foreground.cs` / `foreground.dll` | 只读前台窗口检测的源代码和预编译组件 |
| `identity.cs` | 登记通知快捷方式，读取其 AppUserModelID 并在迁移后更新路径 |
| `identity-app.cs` / `notification-identity.exe` | 开始菜单身份目标的源代码和预编译程序，启动后立即退出 |
| `official-whale.png` / `sender-original.ico` | 原版样式的官方黑鲸鱼 PNG 和 Windows 来源图标 |
| `NOTICE.md` | 官方图形和名称的许可说明 |
| `cordis.patch.yml` / `package.json` | DSH 组合包注册，使插件可启用或停用 |
| `check.mjs` | 通知内容、过滤条件、停用清理、中文路径和原生 XML 检查 |
| `build.ps1` | 维护者重新生成 DLL 的脚本，日常使用不需要运行 |
| `uninstall.ps1` | 移除本精简版的通知来源登记和历史通知 |

运行 `node --test check.mjs` 验证；验证不发送通知、不写注册表。运行 `powershell -NoProfile -ExecutionPolicy Bypass -File .\build.ps1` 重新构建只读组件。
