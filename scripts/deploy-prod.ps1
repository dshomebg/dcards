# Deploy към прода.
#
#   .\scripts\deploy-prod.ps1
#   .\scripts\deploy-prod.ps1 -SkipTests      # преиздаване на вече проверен код
#   .\scripts\deploy-prod.ps1 -AllowDirty     # само при авария
#
# Сървърът няма Node — образът се строи ЛОКАЛНО, тагва се с git SHA и се качва
# като tar. Тагът прави rollback възможен: старите издания остават на машината.
#
# КОМЕНТАРИТЕ са на български, ИЗХОДЪТ е на английски (кирилицата през
# bash → ssh → Windows конзола излиза като въпросителни).
# Сървърната половина е в scripts/remote/deploy.sh.

param(
    [switch]$AllowDirty,   # deploy въпреки незакачени промени (авария)
    [switch]$SkipTests     # без гейта с проверките (известно проверен код)
)

$ErrorActionPreference = 'Stop'
$RemoteHost = 'pagagal'          # от ~/.ssh/config — споделеният сървър
$RemoteDir = '/opt/dcards'
$Image = 'dcards-app-prod'
$PublicUrl = 'https://www.dcards-bg.com'

Set-Location (Split-Path -Parent $PSScriptRoot)

# ASCII only: block glyphs come out as question marks in the Windows console.
$script:TotalPhases = 5
$script:PhaseIndex = 0
$script:Started = Get-Date

function Bar([int]$percent) {
    $filled = [math]::Round($percent / 5)
    return "[$(('#' * $filled) + ('.' * (20 - $filled)))] $percent%"
}

function Elapsed {
    $seconds = [math]::Round(((Get-Date) - $script:Started).TotalSeconds)
    # ЯВНО цяло: `Floor` връща дробно, а форматът `d2` гърми с дробно.
    $minutes = [int][math]::Floor($seconds / 60)
    return "{0:d2}:{1:d2}" -f $minutes, [int]($seconds % 60)
}

function Step($text) {
    $script:PhaseIndex++
    $percent = [int](($script:PhaseIndex - 1) / $script:TotalPhases * 100)
    Write-Host ""
    Write-Host "=== [$($script:PhaseIndex)/$($script:TotalPhases)] $text  $(Bar $percent)  $(Elapsed)" -ForegroundColor Cyan
}
function Ok($text) { Write-Host "  $text" -ForegroundColor Green }
function Die($text) { Write-Host "  $text" -ForegroundColor Red; exit 1 }

<#
Изпълнява bash скрипт на сървъра.

Скриптът се КАЧВА през scp и се изпълнява там, а не се подава на `bash -s`:
PowerShell добавя BOM и CRLF при подаване на низ към външна програма и bash се
спъва в тях НАКРАЯ — успешен deploy рапортува провал. `sed` маха евентуални \r
от страна на сървъра като застраховка.
#>
function Invoke-RemoteScript {
    param(
        [Parameter(Mandatory)][string]$Path,
        [string[]]$Arguments = @()
    )

    $remotePath = "/tmp/dcards-$([System.IO.Path]::GetFileNameWithoutExtension($Path))-$PID.sh"

    scp -q $Path "${RemoteHost}:$remotePath"
    if ($LASTEXITCODE -ne 0) { Die "Cannot upload $Path to the server." }

    # `Out-Host`: иначе изходът на ssh става част от върнатата стойност.
    # `Continue`: docker compose пише напредъка в stderr, а при 'Stop' PowerShell
    # прекъсва ssh по средата и стекът остава наполовина сменен.
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        ssh $RemoteHost "sed -i 's/\r`$//' '$remotePath' && bash '$remotePath' $($Arguments -join ' ')" | Out-Host
        $exitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previous
    }

    ssh $RemoteHost "rm -f '$remotePath'" 2>$null | Out-Null
    return $exitCode
}

# ------------------------------------------------------------------- проверки
Step 'Pre-flight checks'

ssh -o BatchMode=yes -o ConnectTimeout=15 $RemoteHost 'echo ok' | Out-Null
if ($LASTEXITCODE -ne 0) { Die 'Cannot reach the server.' }
Ok 'SSH works'

ssh $RemoteHost "test -f $RemoteDir/.env" | Out-Null
if ($LASTEXITCODE -ne 0) {
    Die "Missing $RemoteDir/.env - run .\scripts\bootstrap-prod.ps1 once."
}
Ok 'Server is prepared'

# Мръсното дърво спира deploy-а: тагът трябва да е възпроизводим от git.
$dirty = git status --porcelain
if ($dirty -and -not $AllowDirty) {
    Write-Host '  Uncommitted changes:' -ForegroundColor Red
    $dirty | Select-Object -First 10 | ForEach-Object { Write-Host "    $_" }
    Die 'Commit them first. Emergency override: -AllowDirty'
}

$ImageTag = (git rev-parse --short HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($ImageTag)) { Die 'Cannot resolve git SHA.' }
if ($dirty) { Write-Host "  WARNING: -AllowDirty. Release $ImageTag does NOT match git." -ForegroundColor Yellow }
Ok "Release: $ImageTag"

# --------------------------------------------------------------------- гейтове
function Took($startedAt) {
    $ms = ((Get-Date) - $startedAt).TotalMilliseconds
    if ($ms -lt 1000) { return "$([int]$ms)ms" }
    return "$([math]::Round($ms / 1000))s"
}

function TestTotals($output) {
    $passed = 0
    foreach ($line in $output) {
        $found = [regex]::Match([string]$line, 'Tests\s+(\d+) passed')
        if ($found.Success) { $passed += [int]$found.Groups[1].Value }
    }
    if ($passed -eq 0) { return '' }
    return " - $passed tests"
}

<#
Пуска един гейт и ПАЗИ изхода: при провал се печатат последните редове, иначе
само обобщението. `2>&1` и `Continue` заедно — иначе stderr редовете стават
изключения и гейтът се къса по средата.
#>
function RunGate($task) {
    $startedAt = Get-Date
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $output = pnpm $task 2>&1
        $failed = $LASTEXITCODE -ne 0
    }
    finally {
        $ErrorActionPreference = $previous
    }
    if ($failed) {
        Write-Host "  --- last lines of `"$task`" ---" -ForegroundColor DarkGray
        $output | Select-Object -Last 25 | ForEach-Object { Write-Host "  $_" }
        Die "`"$task`" failed - deploy aborted."
    }
    Ok "$task - $(Took $startedAt)$(TestTotals $output)"
}

if (-not $SkipTests) {
    Step 'Tests and checks'
    foreach ($task in @('format:check', 'comments:check', 'typecheck', 'lint', 'test')) { RunGate $task }
}

# --------------------------------------------------------------------- строене
Step 'Building image'

# Без `2>&1` върху docker: build-ът пише напредъка в stderr и при 'Stop'
# PowerShell хвърля, въпреки че върви нормално. Успехът се съди по кода на изход.
docker build -f docker/app.Dockerfile -t "${Image}:$ImageTag" .
if ($LASTEXITCODE -ne 0) { Die 'Build failed.' }

$size = docker image inspect "${Image}:$ImageTag" --format '{{.Size}}'
Ok "app - $([math]::Round([int64]$size / 1MB)) MB"

# ------------------------------------------------------------------- качване
Step 'Uploading'

docker save "${Image}:$ImageTag" -o 'app-image.tar'
if ($LASTEXITCODE -ne 0) { Die 'Saving image failed.' }

try {
    $mb = [math]::Round((Get-Item 'app-image.tar').Length / 1MB)
    Write-Host "  app ($mb MB)..."
    scp -C 'app-image.tar' "${RemoteHost}:${RemoteDir}/"
    if ($LASTEXITCODE -ne 0) { Die 'Upload failed.' }
    scp docker-compose.prod.yml "${RemoteHost}:${RemoteDir}/"
    if ($LASTEXITCODE -ne 0) { Die 'Upload of compose file failed.' }
    Ok 'Uploaded'
}
finally {
    Remove-Item 'app-image.tar' -ErrorAction SilentlyContinue
}

# --------------------------------------------------- сървърната част
Step 'Running on the server'
Write-Host '  (database backup, migrations, start, health check)'

$remoteExit = Invoke-RemoteScript -Path 'scripts/remote/deploy.sh' -Arguments @($ImageTag)
if ($remoteExit -ne 0) {
    Write-Host "`n  Deploy failed on the server." -ForegroundColor Red
    Write-Host '  Roll back with: .\scripts\rollback-prod.ps1' -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "=== [5/5] Done - release $ImageTag  $(Bar 100)  $(Elapsed)" -ForegroundColor Green
Write-Host "  $PublicUrl"
Write-Host "  $PublicUrl/api/health/ready"
Write-Host "`n  Roll back:  .\scripts\rollback-prod.ps1" -ForegroundColor DarkGray
