$ErrorActionPreference = 'Stop'
$compiler = Join-Path $env:SystemRoot 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
& $compiler /nologo /target:library /optimize+ /codepage:65001 "/out:$(Join-Path $PSScriptRoot 'foreground.dll')" (Join-Path $PSScriptRoot 'foreground.cs') (Join-Path $PSScriptRoot 'identity.cs')
if ($LASTEXITCODE -ne 0) { throw 'foreground.dll build failed' }
& $compiler /nologo /target:winexe /optimize+ /codepage:65001 "/win32icon:$(Join-Path $PSScriptRoot 'sender-original.ico')" "/out:$(Join-Path $PSScriptRoot 'notification-identity.exe')" (Join-Path $PSScriptRoot 'identity-app.cs')
if ($LASTEXITCODE -ne 0) { throw 'notification-identity.exe build failed' }
