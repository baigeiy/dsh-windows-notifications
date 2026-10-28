param([switch]$SkipRegistration)

$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
$stage = Join-Path $PSScriptRoot ('.rt-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
$backup = Join-Path $PSScriptRoot ('.rb-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
$runtime = Join-Path $PSScriptRoot 'runtime'
$stageRuntime = Join-Path $stage 'runtime'
$stageOwned = $false

function Assert-SafeDirectory([string]$Path) {
    $rootPath = [IO.Path]::GetFullPath($PSScriptRoot).TrimEnd('\')
    $fullPath = [IO.Path]::GetFullPath($Path)
    $allowed = @($runtime, $stage, $backup, $stageRuntime) | ForEach-Object { [IO.Path]::GetFullPath($_) }
    if (-not $fullPath.StartsWith($rootPath + '\', [StringComparison]::OrdinalIgnoreCase) -or $allowed -notcontains $fullPath) {
        throw "Unsafe runtime path: $fullPath"
    }
    $ancestorDirectory = [IO.DirectoryInfo]::new($rootPath)
    while ($ancestorDirectory) {
        if ($ancestorDirectory.Exists -and ($ancestorDirectory.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
            throw "Refusing reparse point: $($ancestorDirectory.FullName)"
        }
        $ancestorDirectory = $ancestorDirectory.Parent
    }
    foreach ($ancestor in @($PSScriptRoot, $stage)) {
        if (($fullPath -eq $ancestor -or $fullPath.StartsWith($ancestor + '\', [StringComparison]::OrdinalIgnoreCase)) -and (Test-Path -LiteralPath $ancestor)) {
            if ((Get-Item -LiteralPath $ancestor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) {
                throw "Refusing reparse point: $ancestor"
            }
        }
    }
    if (Test-Path -LiteralPath $fullPath) {
        $item = Get-Item -LiteralPath $fullPath -Force
        if (-not $item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
            throw "Refusing non-directory or reparse point: $fullPath"
        }
        $links = @(Get-ChildItem -LiteralPath $fullPath -Force -Recurse | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint })
        if ($links.Count) { throw "Refusing a directory containing reparse points: $fullPath" }
    }
}

try {
    if (-not $SkipRegistration) {
        $principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
        if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
            throw 'Run setup.ps1 in an administrator PowerShell to register the Windows notification protocol.'
        }
    }
    $architecture = if ($env:PROCESSOR_ARCHITEW6432) { $env:PROCESSOR_ARCHITEW6432 } else { $env:PROCESSOR_ARCHITECTURE }
    if ([Environment]::OSVersion.Platform -ne 'Win32NT' -or $architecture -ne 'AMD64') {
        throw 'The bundled runtime requires x64 Windows.'
    }
    $manifestPath = Join-Path $PSScriptRoot 'native/manifest.json'
    $archivePath = Join-Path $PSScriptRoot 'native/windows-x64.zip'
    if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf) -or -not (Test-Path -LiteralPath $archivePath -PathType Leaf)) {
        throw 'Bundled runtime is missing. Download a complete release of the plugin.'
    }
    $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
    if ($manifest.archive -ne 'windows-x64.zip' -or $manifest.platform -ne 'win32' -or $manifest.architecture -ne 'x64' -or $manifest.sha256 -notmatch '^[a-fA-F0-9]{64}$') {
        throw 'Invalid bundled runtime manifest.'
    }
    if ((Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash -ne $manifest.sha256) {
        throw 'Bundled runtime checksum does not match. Download the release again.'
    }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [IO.Compression.ZipFile]::OpenRead($archivePath)
    try {
        foreach ($entry in $zip.Entries) {
            $name = $entry.FullName
            $parts = $name.TrimEnd('/').Split('/')
            if (($name -ne 'dsh-notification-activate.exe' -and $name -ne 'runtime/' -and -not $name.StartsWith('runtime/')) -or
                $name.Contains('\') -or ($parts | Where-Object { $_ -eq '' -or $_ -match '[. ]$' -or $_ -match '[<>:"|?*]' })) {
                throw "Unsafe runtime archive entry: $name"
            }
            $unixType = (($entry.ExternalAttributes -shr 16) -band 0xF000)
            if ($unixType -eq 0xA000 -or ($entry.ExternalAttributes -band 0x400)) {
                throw "Reparse point in runtime archive: $name"
            }
            if ((Join-Path $stage $name).Length -ge 260) {
                throw 'The plugin installation path is too long for the bundled Windows runtime. Install the plugin in a shorter directory and run setup.ps1 again.'
            }
        }
    } finally { $zip.Dispose() }
    Assert-SafeDirectory $stage
    if (Test-Path -LiteralPath $stage) { throw 'The runtime staging directory already exists; run setup again.' }
    New-Item -ItemType Directory -Path $stage | Out-Null
    $stageOwned = $true
    Expand-Archive -LiteralPath $archivePath -DestinationPath $stage
    $python = Join-Path $stage 'runtime/python.exe'
    $pythonw = Join-Path $stage 'runtime/pythonw.exe'
    $launcher = Join-Path $stage 'dsh-notification-activate.exe'
    if (-not (Test-Path -LiteralPath $python -PathType Leaf) -or -not (Test-Path -LiteralPath $pythonw -PathType Leaf) -or -not (Test-Path -LiteralPath $launcher -PathType Leaf)) {
        throw 'Bundled runtime archive is incomplete.'
    }
    & $python -c 'import winrt.windows.ui.notifications, winrt.windows.foundation, winrt.windows.system, win32api, pythoncom, PIL, uiautomation'
    if ($LASTEXITCODE -ne 0) { throw 'Bundled Python dependencies failed to load. If Windows reports a path length error, install the plugin in a shorter directory and run setup.ps1 again.' }
    $hadRuntime = Test-Path -LiteralPath $runtime
    Assert-SafeDirectory $runtime
    Assert-SafeDirectory $stageRuntime
    Assert-SafeDirectory $backup
    if (Test-Path -LiteralPath $backup) { throw 'The runtime backup directory already exists; run setup again.' }
    $installedLauncher = Join-Path $PSScriptRoot 'dsh-notification-activate.exe'
    if ((Test-Path -LiteralPath $installedLauncher) -and ((Get-Item -LiteralPath $installedLauncher -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) {
        throw "Refusing reparse point: $installedLauncher"
    }
    if ($hadRuntime) { Move-Item -LiteralPath $runtime -Destination $backup }
    try {
        Assert-SafeDirectory $stageRuntime
        Assert-SafeDirectory $runtime
        Move-Item -LiteralPath $stageRuntime -Destination $runtime
        Copy-Item -LiteralPath $launcher -Destination $installedLauncher -Force
    } catch {
        if (Test-Path -LiteralPath $runtime) { Assert-SafeDirectory $runtime; Remove-Item -LiteralPath $runtime -Recurse -Force }
        if ($hadRuntime) { Assert-SafeDirectory $backup; Assert-SafeDirectory $runtime; Move-Item -LiteralPath $backup -Destination $runtime }
        throw
    }
    if ($hadRuntime) { Assert-SafeDirectory $backup; Remove-Item -LiteralPath $backup -Recurse -Force }
    if (-not $SkipRegistration) {
        & (Join-Path $runtime 'python.exe') ./identity.py
        if ($LASTEXITCODE -ne 0) { throw 'Could not register notification identity.' }
        & (Join-Path $runtime 'python.exe') ./register-machine.py
        if ($LASTEXITCODE -ne 0) { throw 'Could not register the local notification protocol. Run setup as administrator.' }
        & (Join-Path $runtime 'python.exe') ./check-protocol.py
        if ($LASTEXITCODE -ne 0) { throw 'Windows cannot activate the notification protocol.' }
    }
    Write-Host 'Windows notification runtime is ready.'
} finally {
    if ($stageOwned -and (Test-Path -LiteralPath $stage)) { Assert-SafeDirectory $stage; Remove-Item -LiteralPath $stage -Recurse -Force }
    Pop-Location
}
