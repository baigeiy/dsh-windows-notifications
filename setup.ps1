$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
    if (!(Test-Path -LiteralPath '.venv/Scripts/python.exe')) {
        uv venv --python 3.12 .venv
        if ($LASTEXITCODE -ne 0) { throw 'Could not create Python environment. Install uv and retry.' }
    }
    uv pip install --python .venv/Scripts/python.exe -r requirements.txt
    if ($LASTEXITCODE -ne 0) { throw 'Could not install notification dependencies.' }
    & ./.venv/Scripts/python.exe ./identity.py --prepare-icon
    if ($LASTEXITCODE -ne 0) { throw 'Could not prepare notification icon.' }
    & "$env:WINDIR/Microsoft.NET/Framework64/v4.0.30319/csc.exe" /nologo /target:winexe /out:dsh-notification-activate.exe /win32icon:sender.ico notification-launcher.cs
    if ($LASTEXITCODE -ne 0) { throw 'Could not build Windows activation helper.' }
    & ./.venv/Scripts/python.exe ./identity.py
    if ($LASTEXITCODE -ne 0) { throw 'Could not register notification identity.' }
    & ./.venv/Scripts/python.exe ./register-machine.py
    if ($LASTEXITCODE -ne 0) { throw 'Could not register the local notification protocol. Run this setup in an administrator terminal.' }
    & ./.venv/Scripts/python.exe ./check-protocol.py
    if ($LASTEXITCODE -ne 0) { throw 'Windows cannot activate the notification protocol.' }
} finally { Pop-Location }
