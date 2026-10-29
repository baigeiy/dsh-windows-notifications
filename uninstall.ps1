$ErrorActionPreference = 'Stop'
[void][Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime]
[Windows.UI.Notifications.ToastNotificationManager]::History.Clear('DeepSeekHarness.Notifications.Lite')
Add-Type -Path (Join-Path $PSScriptRoot 'foreground.dll')
$shortcut = [DshLiteIdentity]::ShortcutPath
if (Test-Path -LiteralPath $shortcut -PathType Leaf) { Remove-Item -LiteralPath $shortcut }
$shortcutDirectory = Split-Path -Parent $shortcut
if ((Test-Path -LiteralPath $shortcutDirectory) -and @(Get-ChildItem -LiteralPath $shortcutDirectory -Force).Count -eq 0) { Remove-Item -LiteralPath $shortcutDirectory }
[Microsoft.Win32.Registry]::CurrentUser.DeleteSubKey('Software\Classes\AppUserModelId\DeepSeekHarness.Notifications.Lite', $false)
Write-Output 'Lite notification identity removed. Disable or remove the DSH bundle separately.'
