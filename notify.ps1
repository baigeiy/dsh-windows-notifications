param([switch]$ValidateOnly)

$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = New-Object Text.UTF8Encoding($false)
[Console]::OutputEncoding = New-Object Text.UTF8Encoding($false)
$payload = [Console]::In.ReadToEnd() | ConvertFrom-Json
foreach ($field in @('title', 'project', 'detail', 'tag')) {
    if ($payload.$field -isnot [string] -or $payload.$field.Length -gt 1024) { throw "Invalid notification field: $field" }
}
Add-Type -Path (Join-Path $PSScriptRoot 'foreground.dll')
$focused = [DshLiteForeground]::IsFocused()
if ($focused -and !$ValidateOnly) { [Console]::WriteLine('skipped-focused'); exit 0 }

$document = New-Object System.Xml.XmlDocument
$document.LoadXml('<toast activationType="background"><visual><binding template="ToastGeneric"/></visual><actions><action content="关闭" activationType="system" arguments="dismiss"/></actions></toast>')
$binding = $document.SelectSingleNode('/toast/visual/binding')
foreach ($field in @('project', 'title', 'detail')) {
    $text = $document.CreateElement('text')
    $text.InnerText = $payload.$field
    [void]$binding.AppendChild($text)
}
if ($ValidateOnly) {
    @{ focused = $focused; xml = $document.OuterXml } | ConvertTo-Json -Compress
    exit 0
}

$appId = [DshLiteIdentity]::AppId
$icon = Join-Path $PSScriptRoot 'sender-original.ico'
if (!(Test-Path -LiteralPath $icon -PathType Leaf)) { throw 'Missing sender-original.ico; restore the complete plugin folder.' }
$key = [Microsoft.Win32.Registry]::CurrentUser.CreateSubKey("Software\Classes\AppUserModelId\$appId")
try {
    $key.SetValue('DisplayName', [DshLiteIdentity]::DisplayName)
    $key.SetValue('IconUri', $icon)
    $key.SetValue('ShowInSettings', 1, [Microsoft.Win32.RegistryValueKind]::DWord)
} finally { $key.Dispose() }
[DshLiteIdentity]::Ensure($PSScriptRoot)
[void][Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime]
[void][Windows.UI.Notifications.ToastNotifier, Windows.UI.Notifications, ContentType = WindowsRuntime]
[void][Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime]
$xml = New-Object Windows.Data.Xml.Dom.XmlDocument
$xml.LoadXml($document.OuterXml)
$toast = [Windows.UI.Notifications.ToastNotification]::new($xml)
$toast.Tag = $payload.tag
$toast.Group = 'dsh-lite'
$toast.ExpirationTime = [DateTimeOffset]::Now.AddDays(1)
$notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($appId)
$notifier.Show($toast)
[Console]::WriteLine('submitted')
