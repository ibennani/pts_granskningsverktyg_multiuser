# Väntar och försöker skicka uppskjuten klar-notis igen (debounce-retry).
param(
    [int] $DelaySeconds = 10
)
$ErrorActionPreference = 'Stop'
if ($DelaySeconds -lt 1) {
    $DelaySeconds = 1
}
Start-Sleep -Seconds $DelaySeconds

& node (Join-Path $PSScriptRoot 'nabu_work_state.mjs') clear-delayed-flush-scheduled
& (Join-Path $PSScriptRoot 'nabu_try_flush.ps1')
exit $LASTEXITCODE
