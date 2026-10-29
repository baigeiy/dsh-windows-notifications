# 项目文件说明

这份说明介绍仓库中的文件、它们之间的关系，以及安装后在本机生成的数据。普通用户一般只需要阅读[安装说明](../README.md#安装)和运行 `setup.ps1`；其余源码和构建脚本主要供开发者查看、修改和维护。

GitHub 文件列表右侧显示的是该文件最近一次提交的信息。下面的说明提供每个文件的具体用途。

## 插件入口与配置

| 文件 | 用途 |
| --- | --- |
| [package.json](../package.json) | 插件包的清单，记录名称、版本、支持的系统架构、发行包包含哪些文件，以及 DSH 加载插件所需的 bundle 和客户端入口。 |
| [cordis.patch.yml](../cordis.patch.yml) | DSH 组合配置：插入本插件，并配置 Web 服务地址 `baseUrl` 与发送通知的超时 `timeoutMs`。 |
| [index-v5.mjs](../index-v5.mjs) | 服务端主入口。在 DSH 中监听提问、操作确认和根会话完成事件，读取通知偏好、生成点击凭证并启动通知辅助程序；停用插件时清理监听和子进程。 |
| [client.js](../client.js) | DSH 设置界面中的客户端插件。提供 Windows 通知设置表单、图标选择、上传、预览和测试按钮，并连接本机设置接口。文字输入框在宽屏下使用 220 像素宽度并与右边缘对齐，窄屏下换行适应可用空间。 |
| [web-v4.mjs](../web-v4.mjs) | 在 DSH Web 服务中注册设置、图标上传、测试通知、焦点报告和通知点击等接口；检查请求与点击凭证，并为辅助程序提供操作入口。 |
| [native.mjs](../native.mjs) | 从 Node 启动本机 Python 辅助脚本，优先使用发行包解压出的运行环境；收集结果和错误，并限制运行时间。 |
| [preferences.mjs](../preferences.mjs) | 定义默认标题、图标、聚焦开关和「点击通知打开 DSH」开关，校验并读写本机 `settings.json`。 |
| [receipts.mjs](../receipts.mjs) | 保存通知的随机点击凭证和对应标签，使通知在 DSH 正常重启后仍可处理；加载时检查凭证格式并跳过超过 24 小时的记录。 |

## 设置与焦点

| 文件 | 用途 |
| --- | --- |
| [focus.js](../focus.js) | 在 DSH 网页中报告页面是否可见且获得焦点；焦点变化和心跳会更新状态，供通知逻辑决定是否免打扰。 |
| [foreground.py](../foreground.py) | 读取 Windows 当前前台窗口及标题，判断它是否为 DSH；结合网页焦点和用户开关决定是否跳过通知。 |
| [settings-v3.html](../settings-v3.html) | 独立的通知设置页面，提供表单和预览，由 `web-v4.mjs` 提供访问。DSH 设置面板内的表单则由 `client.js` 实现。 |
| [settings.js](../settings.js) | 为独立设置页面处理读取、保存、上传图片、预览、重置和测试通知。 |

## Windows 通知与点击

| 文件 | 用途 |
| --- | --- |
| [notify-v3.py](../notify-v3.py) | 生成 Windows 通知内容并发送，包含标题、正文、图标和「确认收到」动作；按开关决定正文能否跳转及是否显示「打开 dsh」按钮，发送前检查焦点设置。图片地址保留中文字符，并转义空格和 URI 分隔符，以供 Windows 正确读取本机图片。 |
| [identity.py](../identity.py) | 注册通知来源、用户级协议和开始菜单快捷方式，按用户设置生成来源图标与显示名称。初始化和更新外观设置时会调用它。 |
| [identity_constants.py](../identity_constants.py) | 共享通知应用 ID 和协议名，供点击辅助程序读取，避免为标识符加载注册、图片和 COM 组件。 |
| [window_activation.py](../window_activation.py) | 共享浏览器窗口前台激活和任务栏闪烁清除逻辑，供标签查找与通知点击程序调用。 |
| [icons.py](../icons.py) | 处理用户上传的图标：检查图片大小和尺寸，转换为透明 PNG 后保存为本机自定义图标。 |
| [notification-launcher.cs](../notification-launcher.cs) | Windows 协议启动器的源码。只接受指定格式的通知激活地址，然后调用 `activate.py`；发行包中提供预编译程序。 |
| [activate.py](../activate.py) | 处理通知激活：向本机 DSH 接口确认并清除对应通知，按当前开关决定是否尝试切回已有页面；允许跳转且没有可复用页面时打开配置的 DSH 地址。 |
| [clear.py](../clear.py) | 接收通知标签并调用清除逻辑，从 Windows 通知历史中移除对应的本插件通知。 |
| [reuse-browser.py](../reuse-browser.py) | 优先通过浏览器窗口标题直接激活当前显示 DSH 的窗口；需要查找其他标签时加载 Windows UI Automation，找到首个匹配标签即停止。显式传入 `closeHandoff: true` 时可查找并关闭带指定标记的中转标签；正常通知点击不执行这次额外查找。浏览器识别限制见[开发与维护](development.md#运行方式)。 |
| [register-machine.py](../register-machine.py) | 将本插件的专属协议注册到 Windows 的机器级注册表。由 `setup.ps1` 调用，需要管理员权限。 |

一次通知的主要路径是：DSH 事件进入 `index-v5.mjs`，经过焦点判断后由 `notify-v3.py` 发送；点击「打开 dsh」时，Windows 启动协议处理程序，`activate.py` 经本机接口调用标签复用逻辑。

## 初始化、构建与发行

| 文件 | 用途 |
| --- | --- |
| [setup.ps1](../setup.ps1) | 用户首次初始化脚本。检查系统架构、运行包校验和与路径，解压并验证运行环境，然后注册通知身份和 Windows 协议。普通初始化需要管理员权限；`-SkipRegistration` 用于不改注册项的验证。 |
| [native/windows-x64.zip](../native/windows-x64.zip) | 预构建的 Windows x64 运行环境压缩包，包含便携 Python、所需依赖和编译好的协议启动器；初始化时解压到安装目录。 |
| [native/manifest.json](../native/manifest.json) | 记录运行包的 SHA-256、平台架构、Python 来源和版本，以及依赖锁文件、启动器源码的哈希；供初始化与发行脚本核对。 |
| [requirements.txt](../requirements.txt) | 列出通知、Windows 系统接口、图片和浏览器自动化所需的 Python 直接依赖及版本。普通用户不需要手动安装。 |
| [requirements.lock](../requirements.lock) | 锁定运行环境的直接和间接 Python 依赖及包哈希，供维护者构建运行包时使用。 |
| [build-runtime.ps1](../build-runtime.ps1) | 维护者脚本：下载并校验 Python 嵌入包，安装锁定的二进制依赖，编译启动器并生成 `native/` 中的压缩包和清单。 |
| [build-release.ps1](../build-release.ps1) | 维护者脚本：检查运行包与源码哈希，用包清单创建 `.tgz`、Windows ZIP 和 `SHA256SUMS.txt`；检查发行内容不包含指定的本机数据。 |

## 检查脚本

这些脚本供开发和排查使用，不是日常运行通知时需要手动打开的文件。实际验证方法见[开发与维护](development.md#验证)。

| 文件 | 用途 |
| --- | --- |
| [check-activation.py](../check-activation.py) | 用模拟请求验证通知激活：复用已有标签、没有标签时打开地址，以及无效或失败凭证的处理。 |
| [check-reuse.py](../check-reuse.py) | 用模拟的窗口与浏览器控件检查寻找和切换已有 DSH 标签的逻辑。 |
| [check-focus.py](../check-focus.py) | 检查 DSH 窗口标题识别和聚焦时是否抑制通知的规则。 |
| [check-image.py](../check-image.py) | 检查中文图片地址、特殊字符转义、XML 内容，并用 Windows URL 读取器读取临时图片；不发送通知。 |
| [check-protocol.py](../check-protocol.py) | 查询 Windows 是否支持本插件的通知协议；只做查询，不启动页面。 |
| [check-distribution.ps1](../check-distribution.ps1) | 在隔离目录复制发行文件，验证解压后的依赖、行为测试、重复初始化、校验失败和长路径处理；使用 `-SkipRegistration`，不进行系统注册。 |

## 图像、文档与仓库规则

| 文件或目录 | 用途 |
| --- | --- |
| [official-whale.png](../official-whale.png) | 内置的 DSH 官方鲸鱼图案，可作为通知的应用来源图标或提示图标。图案与商标说明见 `NOTICE.md`。 |
| [whale-icon.png](../whale-icon.png) | 内置「大肥鱼」透明图标，用于通知提示图标，也可选择作为应用来源图标。 |
| [whale.png](../whale.png) | 「大肥鱼」图像资源，由 Web 服务提供给页面使用。 |
| [screenshots.json](../screenshots.json) | 列出插件展示截图，当前指向设置页面截图。 |
| [docs/](.) | 保存首页横幅、设置截图、开发维护文档、文件说明及版本说明。 |
| [docs/banner.svg](banner.svg) | GitHub 项目首页顶部的横幅图。 |
| [docs/settings.png](settings.png) | 首页展示的插件设置页面截图。 |
| [docs/development.md](development.md) | 介绍运行方式、浏览器限制、本机数据、卸载、验证及维护者构建步骤。 |
| [docs/files.md](files.md) | 本文件：按用途解释仓库文件和本机生成的数据。 |
| [docs/releases/v0.7.0.md](releases/v0.7.0.md) | v0.7.0 的下载选项、初始化提示和版本说明。 |
| [docs/releases/v0.7.1.md](releases/v0.7.1.md) | v0.7.1 的图片路径修复、下载方式和更新提示。 |
| [docs/releases/v0.7.2.md](releases/v0.7.2.md) | v0.7.2 的打开 DSH 开关、点击提速、设置布局和下载说明。 |
| [README.md](../README.md) | 项目首页，介绍功能、安装、设置和使用限制。 |
| [LICENSE](../LICENSE) | 插件代码的 MIT 许可证。 |
| [NOTICE.md](../NOTICE.md) | 图片、商标和内置第三方运行环境的许可说明。 |
| [.gitignore](https://github.com/baigeiy/dsh-windows-notifications/blob/main/.gitignore) | 使用白名单选择提交到 Git 的文件，避免将本机偏好、收据、日志、运行环境和构建产物一并提交。 |
| [.gitattributes](https://github.com/baigeiy/dsh-windows-notifications/blob/main/.gitattributes) | 规定文本文件的换行处理，并将图片、图标和 ZIP 等标记为二进制文件。 |

## 安装后生成的本机文件

这些文件不属于公开仓库中的源码。安装目录可能因用户的安装方式不同而不同；修改或删除前先备份需要保留的设置。

| 文件或目录 | 用途 |
| --- | --- |
| `runtime/` | `setup.ps1` 解压出的便携 Python 与依赖，通知辅助程序从这里运行。 |
| `dsh-notification-activate.exe` | 从运行包解压出的协议启动器；Windows 点击通知时会使用它。 |
| `settings.json` | 用户选择的通知标题、图标和聚焦开关等偏好。 |
| `custom-app.png`、`custom-notification.png` | 用户上传并转换后的应用来源图标和通知图标。 |
| `receipts.json` | 通知点击凭证与对应标签的本机记录。 |
| `runtime.json` | DSH 写入的当前服务地址，供通知点击处理程序读取。 |
| `identity.json`、`sender.ico` | 通知来源身份的缓存信息和生成的 Windows 图标。 |
| `events.jsonl`、`activation-launcher.log`、`activation-errors.log`、`reuse-state.json`、`reuse-errors.log` | 插件运行、通知激活及标签复用过程中可能产生的诊断记录。 |
| `build/`、`dist/` | 维护者构建时产生的临时文件、缓存和发行包；普通用户无需手动创建。 |

初始化还会写入 Windows 注册表和开始菜单快捷方式。清理方法及注意事项见[本机数据和卸载](development.md#本机数据和卸载)。
