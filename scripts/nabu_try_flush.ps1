# Försöker skicka uppskjuten klar-notis om arbetskön är tom.
param(
    [string] $Message = ''
)
$ErrorActionPreference = 'Stop'
$repo_root = Split-Path -Parent $PSScriptRoot
$state_script = Join-Path $PSScriptRoot 'nabu_work_state.mjs'

$raw = & node $state_script try-flush
if (-not $raw) {
    Write-Host '[nabu_try_flush] Tomt svar från try-flush.'
    exit 1
}

$result = $raw | ConvertFrom-Json
if ($result.sent -eq $true) {
    if ($Message.Length -eq 0) {
        Write-Host '[nabu_try_flush] Meddelande saknas trots sent=true.'
        exit 1
    }
    & (Join-Path $PSScriptRoot 'nabu_send_webhook.ps1') -Message $Message
    exit $LASTEXITCODE
}

switch ($result.reason) {
    'no_request' {
        Write-Host '[nabu_try_flush] Ingen begärd klar-notis.'
    }
    'pending_subagents' {
        Write-Host "[nabu_try_flush] Uppskjuten: $($result.count) underagent(er) kör fortfarande."
    }
    'open_todos' {
        Write-Host "[nabu_try_flush] Uppskjuten: $($result.count) öppen(a) todo(s)."
    }
    'debounce' {
        Write-Host "[nabu_try_flush] Uppskjuten: debounce (väntar $($result.wait_ms) ms)."
        if ($result.schedule_delayed_flush -eq $true) {
            $delayed = Join-Path $PSScriptRoot 'nabu_delayed_flush.ps1'
            Start-Process -FilePath 'powershell.exe' -ArgumentList @(
                '-NoProfile',
                '-ExecutionPolicy', 'Bypass',
                '-File', $delayed,
                '-Message', $Message
            ) -WindowStyle Hidden | Out-Null
        }
    }
    default {
        Write-Host "[nabu_try_flush] Uppskjuten: $($result.reason)"
    }
}
exit 0
