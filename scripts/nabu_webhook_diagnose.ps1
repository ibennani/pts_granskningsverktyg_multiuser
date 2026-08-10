# Diagnostik för Nabu/HA-webhook (HTTP-svar, ingen hemlig URL i utdata).
$ErrorActionPreference = 'Stop'
$repo_root = Split-Path -Parent $PSScriptRoot
& (Join-Path $PSScriptRoot 'nabu_send_webhook.ps1') -Message "Webhook-diagnostik $(Get-Date -Format 'HH:mm:ss')"
