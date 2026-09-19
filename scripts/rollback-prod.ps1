# Връщане на прода към предишно издание.
#
#   .\scripts\rollback-prod.ps1              # към предишното
#   .\scripts\rollback-prod.ps1 -Sha abc1234 # към конкретно
#
# ВАЖНО ЗА БАЗАТА: това връща КОДА, не схемата. Ако проваленото издание е
# приложило миграция, старият код може да не разбира новата схема. Затова
# преди всяка миграция се прави dump — виж /backup/dcards/pre-deploy/.
#
# Коментарите са на български, изходът — на английски (виж deploy-prod.ps1).

param(
    [string]$Sha,
    # Без питане. За автоматизация — при ръчно пускане потвърждението остава.
    [switch]$Yes
)

$ErrorActionPreference = 'Stop'
$RemoteHost = 'pagagal'
$RemoteDir = '/opt/dcards'

Set-Location (Split-Path -Parent $PSScriptRoot)

function Die($text) { Write-Host "  $text" -ForegroundColor Red; exit 1 }

# Виж бележката в deploy-prod.ps1: скриптът се качва, не се подава по тръба.
function Invoke-RemoteScript {
    param(
        [Parameter(Mandatory)][string]$Path,
        [string[]]$Arguments = @()
    )

    $remotePath = "/tmp/dcards-$([System.IO.Path]::GetFileNameWithoutExtension($Path))-$PID.sh"

    scp -q $Path "${RemoteHost}:$remotePath"
    if ($LASTEXITCODE -ne 0) { Die "Cannot upload $Path to the server." }

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

Write-Host "`n=== Rollback ===" -ForegroundColor Cyan

ssh -o BatchMode=yes -o ConnectTimeout=15 $RemoteHost 'echo ok' | Out-Null
if ($LASTEXITCODE -ne 0) { Die 'Cannot reach the server.' }

$history = @(ssh $RemoteHost "cat $RemoteDir/.deploy-history 2>/dev/null") |
    ForEach-Object { $_.Trim() } | Where-Object { $_ -ne '' }

if ($history.Count -eq 0) { Die 'No release history - nothing to roll back to.' }

$current = $history[0]
if ($Sha) {
    $target = $Sha.Trim()
}
else {
    if ($history.Count -lt 2) { Die "Only one release recorded ($current). Pass -Sha explicitly." }
    $target = $history[1]
}
if ($target -eq $current) { Die "Release $target is already current." }

Write-Host "`n  Release history (newest first):"
for ($i = 0; $i -lt $history.Count; $i++) {
    $mark = if ($i -eq 0) { ' <- current' } elseif ($history[$i] -eq $target) { ' <- target' } else { '' }
    Write-Host "    $($history[$i])$mark"
}

Write-Host "`n  Pre-deploy dumps (if a migration ran between them, the schema is newer):"
ssh $RemoteHost 'ls -1t /backup/dcards/pre-deploy/*.sql.gz 2>/dev/null | head -5' |
    ForEach-Object { Write-Host "    $(Split-Path $_ -Leaf)" }

Write-Host "`n  PROCEED: $current -> $target" -ForegroundColor Yellow
if (-not $Yes) {
    $confirm = Read-Host '  Type YES to continue'
    if ($confirm -ne 'YES') { Die 'Cancelled.' }
}

$remoteExit = Invoke-RemoteScript -Path 'scripts/remote/rollback.sh' -Arguments @($target)
if ($remoteExit -ne 0) {
    Write-Host "`n  Rolled back, but the health check did not pass. Check the logs:" -ForegroundColor Red
    Write-Host "    ssh $RemoteHost 'docker logs dcards-app-prod --tail 50'" -ForegroundColor Yellow
    exit 1
}

Write-Host "`n=== Rolled back to $target ===" -ForegroundColor Green
