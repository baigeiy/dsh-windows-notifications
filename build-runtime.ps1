# Maintainer-only build. End users run setup.ps1 with the bundled archive.
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$build = Join-Path $root ('build/runtime-' + [guid]::NewGuid().ToString('N'))
$runtime = Join-Path $build 'runtime'
New-Item -ItemType Directory -Force -Path $runtime, (Join-Path $root 'native') | Out-Null
$env:UV_CACHE_DIR = Join-Path $root 'build/uv-cache'
$env:UV_PYTHON_INSTALL_DIR = Join-Path $root 'build/uv-python'
$env:UV_PYTHON_DOWNLOADS = 'never'
$env:TEMP = Join-Path $root 'build/tmp'
$env:TMP = $env:TEMP
New-Item -ItemType Directory -Force -Path $env:TEMP | Out-Null
$version = '3.13.17'
$url = "https://www.python.org/ftp/python/$version/python-$version-embeddable-amd64.zip"
# SHA256 from Python.org's windows-3.13.17.json release manifest.
$expected = '0ba1ee4bfcbdc3a559d27e2e9ce76d04a7839947a23f46375872c755c0d463b8'
$download = Join-Path $root "build/downloads/python-$version-verified.zip"
New-Item -ItemType Directory -Force -Path (Split-Path $download) | Out-Null
if (-not (Test-Path -LiteralPath $download)) { Invoke-WebRequest -Uri $url -OutFile $download }
if ((Get-FileHash -LiteralPath $download -Algorithm SHA256).Hash -ne $expected) { throw 'Python archive checksum mismatch.' }
Expand-Archive -LiteralPath $download -DestinationPath $runtime
$utf8 = New-Object Text.UTF8Encoding($false)
[IO.File]::WriteAllText((Join-Path $runtime 'python313._pth'), "python313.zip`n.`n..`nLib`nLib/win32`nLib/win32/lib`nLib/Pythonwin`nimport site`n", $utf8)
& uv pip install --python (Join-Path $runtime 'python.exe') --target (Join-Path $runtime 'Lib') --require-hashes --only-binary :all: -r (Join-Path $root 'requirements.lock')
if ($LASTEXITCODE -ne 0) { throw 'Could not install locked binary dependencies.' }
[IO.File]::WriteAllText((Join-Path $runtime 'sitecustomize.py'), "import sys`nsys.dont_write_bytecode = True`nimport pywin32_bootstrap`n", $utf8)
& (Join-Path $runtime 'python.exe') -c 'import winrt.windows.ui.notifications, winrt.windows.foundation, winrt.windows.system, win32api, pythoncom, PIL, uiautomation'
if ($LASTEXITCODE -ne 0) { throw 'Portable runtime dependency check failed.' }
[IO.File]::WriteAllText((Join-Path $build 'build-icon.py'), 'from PIL import Image; import sys; Image.open(sys.argv[1]).convert("RGBA").save(sys.argv[2], format="ICO", sizes=[(16,16),(32,32),(48,48),(256,256)])', $utf8)
& (Join-Path $runtime 'python.exe') (Join-Path $build 'build-icon.py') (Join-Path $root 'official-whale.png') (Join-Path $build 'launcher.ico')
if ($LASTEXITCODE -ne 0) { throw 'Could not build launcher icon.' }
& "$env:WINDIR/Microsoft.NET/Framework64/v4.0.30319/csc.exe" /nologo /target:winexe "/out:$build/dsh-notification-activate.exe" "/win32icon:$build/launcher.ico" (Join-Path $root 'notification-launcher.cs')
if ($LASTEXITCODE -ne 0) { throw 'Could not compile Windows launcher.' }
$archive = Join-Path $root 'native/windows-x64.zip'
$zipScript = @'
import pathlib, sys, zipfile
root = pathlib.Path(sys.argv[1])
with zipfile.ZipFile(sys.argv[2], 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as bundle:
    for path in sorted((root / 'runtime').rglob('*')):
        if path.is_file() and '__pycache__' not in path.parts and path.suffix != '.pyc':
            bundle.write(path, path.relative_to(root).as_posix())
    bundle.write(root / 'dsh-notification-activate.exe', 'dsh-notification-activate.exe')
'@
[IO.File]::WriteAllText((Join-Path $build 'pack.py'), $zipScript, $utf8)
& (Join-Path $runtime 'python.exe') (Join-Path $build 'pack.py') $build $archive
if ($LASTEXITCODE -ne 0) { throw 'Could not pack portable runtime.' }
$manifest = [ordered]@{
    archive = 'windows-x64.zip'; sha256 = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
    platform = 'win32'; architecture = 'x64'; pythonVersion = $version
    pythonSource = $url; pythonSha256 = $expected
    requirementsSha256 = (Get-FileHash -LiteralPath (Join-Path $root 'requirements.lock') -Algorithm SHA256).Hash.ToLowerInvariant()
    launcherSourceSha256 = (Get-FileHash -LiteralPath (Join-Path $root 'notification-launcher.cs') -Algorithm SHA256).Hash.ToLowerInvariant()
}
[IO.File]::WriteAllText((Join-Path $root 'native/manifest.json'), ($manifest | ConvertTo-Json) + "`n", $utf8)
Write-Host "Bundled runtime: $archive"
