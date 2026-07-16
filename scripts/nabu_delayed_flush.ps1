# Väntar och försöker skicka uppskjuten klar-notis igen (debounce-retry).
param(
    [string] $Message = ''
)
$ErrorActionPreference = 'Stop'
$delay_seconds = 10
Start-Sleep -Seconds $delay_seconds

& (Join-Path $PSScriptRoot 'nabu_try_flush.ps1') -Message $Message
exit $LASTEXITCODE
