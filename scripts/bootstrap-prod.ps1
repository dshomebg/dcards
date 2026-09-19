# Еднократна подготовка на сървъра.
#
#   .\scripts\bootstrap-prod.ps1
#
# Създава /opt/dcards, генерира тайните и качва .env. Пуска се ВЕДНЪЖ, преди
# първия deploy. Отказва да продължи, ако вече има .env — паролата на живата
# база не се сменя случайно. Тайните се раждат тук и НЕ се пазят другаде.
#
# Коментарите са на български, изходът — на английски (виж deploy-prod.ps1).

param(
    # Без питане. За автоматизация — при ръчно пускане потвърждението остава.
    [switch]$Yes
)

$ErrorActionPreference = 'Stop'
$RemoteHost = 'pagagal'
$RemoteDir = '/opt/dcards'
$Domain = 'dcards-bg.com'

Set-Location (Split-Path -Parent $PSScriptRoot)

function Die($text) { Write-Host "  $text" -ForegroundColor Red; exit 1 }

# Криптографски случаен низ, годен за парола в URL (без +/=, които биха искали
# екраниране в DATABASE_URL). `RNGCryptoServiceProvider` — PowerShell 5.1 е .NET
# Framework и няма `RandomNumberGenerator.Fill`.
function New-Secret([int]$length = 40) {
    # Двойно повече байтове от искания низ: махането на +/= скъсява base64 и
    # 48 байта не стигаха за 64 знака (Substring гърмеше при първия bootstrap).
    $buffer = New-Object byte[] ($length * 2)
    $rng = New-Object System.Security.Cryptography.RNGCryptoServiceProvider
    try { $rng.GetBytes($buffer) } finally { $rng.Dispose() }
    $clean = [Convert]::ToBase64String($buffer) -replace '[+/=]', ''
    $clean.Substring(0, $length)
}

# Чете стойност от ЛОКАЛНИЯ .env — паролата на пощата не се преписва на ръка.
function LocalEnv($name) {
    $file = Join-Path (Get-Location) '.env'
    if (-not (Test-Path $file)) { return '' }
    foreach ($line in Get-Content $file -Encoding utf8) {
        $trimmed = $line.Trim()
        if ($trimmed.StartsWith('#')) { continue }
        $at = $trimmed.IndexOf('=')
        if ($at -lt 1) { continue }
        if ($trimmed.Substring(0, $at).Trim() -ne $name) { continue }
        return $trimmed.Substring($at + 1).Trim().Trim('"').Trim("'")
    }
    return ''
}

Write-Host "`n=== Server bootstrap ===" -ForegroundColor Cyan

ssh -o BatchMode=yes -o ConnectTimeout=15 $RemoteHost 'echo ok' | Out-Null
if ($LASTEXITCODE -ne 0) { Die 'Cannot reach the server.' }

$exists = ssh $RemoteHost "test -f $RemoteDir/.env && echo yes || echo no"
if ($exists.Trim() -eq 'yes') {
    Die "$RemoteDir/.env already exists. Bootstrap is for first install; rotate secrets manually."
}

Write-Host "  Will create $RemoteDir on $RemoteHost and generate new secrets."
Write-Host '  Neighbouring projects (pagagal, natura, sp-fitness, elkorekt, nextcloud) are not touched.' -ForegroundColor DarkGray
if (-not $Yes) {
    $confirm = Read-Host '  Type YES to continue'
    if ($confirm -ne 'YES') { Die 'Cancelled.' }
}

# ------------------------------------------------------------------- тайните
$postgresPassword = New-Secret
$sessionSecret = New-Secret 64
$mailPass = LocalEnv 'MAIL_PASS'

$envContent = @"
# DCARDS - production environment.
# Created by scripts/bootstrap-prod.ps1. NEVER committed to git.
#
# WARNING: ALWAYS QUOTE A VALUE THAT CONTAINS SPACES. The deploy script reads
# this file through the shell (set -a; . ./.env).

APP_SLUG=dcards
APP_NAME=DCARDS
NODE_ENV=production

# Host port. Nginx on the host proxies $Domain to it.
APP_PORT=3010
APP_URL=https://www.$Domain

POSTGRES_USER=dcards
POSTGRES_PASSWORD=$postgresPassword
POSTGRES_DB=dcards

# Signs session cookies. Generated once, right here.
SESSION_SECRET=$sessionSecret

UPLOADS_DIR=/app/uploads

# Mail via Hestia on the same server (INF-3).
MAIL_HOST=mail.$Domain
MAIL_PORT=465
MAIL_SECURE=true
MAIL_USER=info@$Domain
MAIL_PASS=$mailPass
MAIL_FROM="DCARDS <info@$Domain>"

STORE_CURRENCY=BGN
STORE_LOCALE=bg-BG
"@

Write-Host "`n  Creating directories..."
ssh $RemoteHost "mkdir -p $RemoteDir /backup/dcards/pre-deploy && chmod 750 $RemoteDir"
if ($LASTEXITCODE -ne 0) { Die 'Creating directories failed.' }

# Записва се ЧАК СЕГА, точно преди качването — всяка секунда, в която пълен
# прод .env лежи в temp папката на Windows, е прозорец за изтичане. LF окончания.
$tmp = [System.IO.Path]::GetTempFileName()
[System.IO.File]::WriteAllText($tmp, ($envContent -replace "`r`n", "`n"), (New-Object System.Text.UTF8Encoding $false))

Write-Host '  Uploading .env...'
try {
    scp $tmp "${RemoteHost}:${RemoteDir}/.env" | Out-Null
} finally {
    Remove-Item $tmp -Force -ErrorAction SilentlyContinue
}
ssh $RemoteHost "chmod 600 $RemoteDir/.env"
if ($LASTEXITCODE -ne 0) { Die 'Uploading .env failed.' }

Write-Host '  Uploading compose file...'
scp docker-compose.prod.yml "${RemoteHost}:${RemoteDir}/" | Out-Null

Write-Host "`n=== Done ===" -ForegroundColor Green
Write-Host "  $RemoteDir created, secrets generated and stored only there."
if ($mailPass -eq '') {
    Write-Host '  MAIL_PASS is empty - local .env had none. Set it in the server .env.' -ForegroundColor Yellow
}
Write-Host "`n  Next:"
Write-Host '    1. .\scripts\deploy-prod.ps1'
Write-Host "    2. point nginx for $Domain at 127.0.0.1:3010 (see docs/go-live.md)" -ForegroundColor Yellow
