# Väntar och försöker skicka uppskjuten klar-notis igen (debounce-retry).
$ErrorActionPreference = 'Stop'
$delay_seconds = 10
Start-Sleep -Seconds $delay_seconds

& node (Join-Path $PSScriptRoot 'nabu_work_state.mjs') clear-delayed-flush-scheduled
& (Join-Path $PSScriptRoot 'nabu_try_flush.ps1')
exit $LASTEXITCODE
