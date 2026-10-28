# Package only the declared npm payload, never the live plugin directory.
$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
    $package = Get-Content -LiteralPath 'package.json' -Raw -Encoding UTF8 | ConvertFrom-Json
    $manifest = Get-Content -LiteralPath 'native/manifest.json' -Raw -Encoding UTF8 | ConvertFrom-Json
    if ((Get-FileHash -LiteralPath 'native/windows-x64.zip' -Algorithm SHA256).Hash -ne $manifest.sha256) { throw 'Runtime archive checksum mismatch.' }
    foreach ($item in @(@('requirements.lock', 'requirementsSha256'), @('notification-launcher.cs', 'launcherSourceSha256'))) {
        if ((Get-FileHash -LiteralPath $item[0] -Algorithm SHA256).Hash -ne $manifest.($item[1])) { throw "Rebuild the native runtime after changing $($item[0])." }
    }
    $dist = Join-Path $PSScriptRoot 'dist'
    New-Item -ItemType Directory -Force -Path $dist | Out-Null
    $tarball = Join-Path $dist "$($package.name)-$($package.version).tgz"
    & pnpm pack --out $tarball
    if ($LASTEXITCODE -ne 0) { throw 'pnpm pack failed.' }
    $stage = Join-Path $PSScriptRoot ('build/release-' + [guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Force -Path $stage | Out-Null
    & tar -xf $tarball -C $stage
    if ($LASTEXITCODE -ne 0) { throw 'Could not extract package for ZIP distribution.' }
    $payload = Join-Path $stage 'package'
    foreach ($file in @('native/windows-x64.zip', 'native/manifest.json', 'setup.ps1', 'index-v5.mjs', 'client.js')) {
        if (-not (Test-Path -LiteralPath (Join-Path $payload $file))) { throw "Missing published file: $file" }
    }
    foreach ($file in @('settings.json', 'receipts.json', 'runtime.json', 'identity.json', '.venv', 'runtime', 'events.jsonl')) {
        if (Test-Path -LiteralPath (Join-Path $payload $file)) { throw "Private runtime state in package: $file" }
    }
    $zip = Join-Path $dist "$($package.name)-$($package.version)-win-x64.zip"
    Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem
    $stream = [IO.File]::Open($zip, [IO.FileMode]::Create)
    $archive = New-Object IO.Compression.ZipArchive($stream, [IO.Compression.ZipArchiveMode]::Create)
    try {
        foreach ($file in Get-ChildItem -LiteralPath $payload -File -Recurse) {
            $relative = $file.FullName.Substring($payload.Length + 1).Replace('\', '/')
            [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $file.FullName, $relative, [IO.Compression.CompressionLevel]::Optimal) | Out-Null
        }
    } finally { $archive.Dispose(); $stream.Dispose() }
    $sums = @($tarball, $zip) | ForEach-Object { (Get-FileHash -LiteralPath $_ -Algorithm SHA256).Hash.ToLowerInvariant() + '  ' + [IO.Path]::GetFileName($_) }
    [IO.File]::WriteAllText((Join-Path $dist 'SHA256SUMS.txt'), ($sums -join "`n") + "`n", (New-Object Text.UTF8Encoding($false)))
    Get-Item -LiteralPath $tarball, $zip | Select-Object Name, Length
} finally { Pop-Location }
