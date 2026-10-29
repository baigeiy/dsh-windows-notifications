$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$testRoot = Join-Path $root ('build/distribution-check-' + [guid]::NewGuid().ToString('N'))
$package = Join-Path $testRoot 'package'
$temp = Join-Path $testRoot 'tmp'
$previousTemp = $env:TEMP
$previousTmp = $env:TMP

function Get-RuntimeSnapshot([string]$Directory) {
    $prefix = [IO.Path]::GetFullPath($Directory).TrimEnd('\') + '\'
    @(Get-ChildItem -LiteralPath $Directory -File -Recurse | Sort-Object FullName | ForEach-Object {
        $_.FullName.Substring($prefix.Length) + ':' + (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash
    }) -join "`n"
}

try {
    New-Item -ItemType Directory -Force -Path $package, $temp | Out-Null
    $env:TEMP = $temp
    $env:TMP = $temp
    $manifest = Get-Content -LiteralPath (Join-Path $root 'package.json') -Raw -Encoding UTF8 | ConvertFrom-Json
    Copy-Item -LiteralPath (Join-Path $root 'package.json') -Destination (Join-Path $package 'package.json')
    foreach ($relative in $manifest.files) {
        $source = Join-Path $root $relative
        if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw "Missing package file: $relative" }
        $destination = Join-Path $package $relative
        New-Item -ItemType Directory -Force -Path (Split-Path -Parent $destination) | Out-Null
        Copy-Item -LiteralPath $source -Destination $destination
    }
    $setup = Join-Path $package 'setup.ps1'
    & $setup -SkipRegistration
    $python = Join-Path $package 'runtime/python.exe'
    & $python -c 'import winrt.windows.ui.notifications, winrt.windows.foundation, winrt.windows.system, win32api, pythoncom, PIL, uiautomation'
    if ($LASTEXITCODE -ne 0) { throw 'Installed runtime dependency check failed.' }
    foreach ($test in @('check-activation.py', 'check-reuse.py', 'check-focus.py', 'check-image.py')) {
        & $python (Join-Path $package $test)
        if ($LASTEXITCODE -ne 0) { throw "Installed runtime test failed: $test" }
    }
    & $setup -SkipRegistration
    $runtime = Join-Path $package 'runtime'
    $before = Get-RuntimeSnapshot $runtime
    $manifestPath = Join-Path $package 'native/manifest.json'
    $archiveManifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $archiveManifest.sha256 = '0' * 64
    [IO.File]::WriteAllText($manifestPath, ($archiveManifest | ConvertTo-Json), [Text.UTF8Encoding]::new($false))
    $rejected = $false
    try { & $setup -SkipRegistration }
    catch {
        if ($_.Exception.Message -notmatch 'checksum does not match') { throw }
        $rejected = $true
    }
    if (-not $rejected) { throw 'Setup accepted a mismatched archive checksum.' }
    if ((Get-RuntimeSnapshot $runtime) -cne $before) { throw 'Runtime changed after checksum failure.' }
    & $python -c 'import winrt.windows.ui.notifications, winrt.windows.foundation, winrt.windows.system, win32api, pythoncom, PIL, uiautomation'
    if ($LASTEXITCODE -ne 0) { throw 'Runtime failed after checksum rejection.' }
    $padding = [Math]::Max(1, 180 - $testRoot.Length - 11)
    $longDirectory = Join-Path $testRoot ('long-path-' + ('x' * $padding))
    New-Item -ItemType Directory -Force -Path (Join-Path $longDirectory 'native') | Out-Null
    Copy-Item -LiteralPath (Join-Path $root 'setup.ps1') -Destination (Join-Path $longDirectory 'setup.ps1')
    Copy-Item -LiteralPath (Join-Path $root 'native/manifest.json') -Destination (Join-Path $longDirectory 'native/manifest.json')
    Copy-Item -LiteralPath (Join-Path $root 'native/windows-x64.zip') -Destination (Join-Path $longDirectory 'native/windows-x64.zip')
    $rejected = $false
    try { & (Join-Path $longDirectory 'setup.ps1') -SkipRegistration }
    catch {
        if ($_.Exception.Message -notmatch 'installation path is too long') { throw }
        $rejected = $true
    }
    if (-not $rejected) { throw 'Setup accepted an installation path that is too long.' }
    Write-Host "Distribution checks passed: $testRoot"
} finally {
    $env:TEMP = $previousTemp
    $env:TMP = $previousTmp
}
