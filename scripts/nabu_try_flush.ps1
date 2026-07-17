# Försöker skicka uppskjuten klar-notis om arbetskön är tom.
param(
    [string] $Message = ''
)
$ErrorActionPreference = 'Stop'
$repo_root = Split-Path -Parent $PSScriptRoot
$state_script = Join-Path $PSScriptRoot 'nabu_work_state.mjs'
$message_path = Join-Path (Join-Path $repo_root '.cursor') 'nabu_flush_message.txt'

function Save-FlushMessage {
    param([string] $Text)
    if ($Text.Length -eq 0) {
        return
    }
    $cursor_dir = Split-Path -Parent $message_path
    if (-not (Test-Path -LiteralPath $cursor_dir)) {
        New-Item -ItemType Directory -Path $cursor_dir | Out-Null
    }
    [System.IO.File]::WriteAllText($message_path, $Text, [System.Text.UTF8Encoding]::new($false))
}

function Read-FlushMessage {
    if ($Message.Length -gt 0) {
        return $Message
    }
    if (-not (Test-Path -LiteralPath $message_path)) {
        return ''
    }
    return [System.IO.File]::ReadAllText($message_path, [System.Text.UTF8Encoding]::new($false)).Trim()
}

function Get-RetryDelaySeconds {
    param($Result)
    if ($Result.retry_delay_ms -and [int]$Result.retry_delay_ms -gt 0) {
        $seconds = [Math]::Ceiling([int]$Result.retry_delay_ms / 1000.0)
        if ($seconds -lt 1) {
            return 1
        }
        return $seconds
    }
    return 10
}

function Schedule-DelayedFlush {
    param(
        [string] $Text,
        [int] $DelaySeconds = 10
    )
    Save-FlushMessage -Text $Text
    $delayed = Join-Path $PSScriptRoot 'nabu_delayed_flush.ps1'
    Start-Process -FilePath 'powershell.exe' -ArgumentList @(
        '-NoProfile',
        '-ExecutionPolicy', 'Bypass',
        '-File', $delayed,
        '-DelaySeconds', $DelaySeconds
    ) -WindowStyle Hidden | Out-Null
}

$resolved_message = Read-FlushMessage
if ($Message.Length -gt 0) {
    Save-FlushMessage -Text $Message
    $resolved_message = $Message
}

$raw = & node $state_script try-flush
if (-not $raw) {
    Write-Host '[nabu_try_flush] Tomt svar från try-flush.'
    exit 1
}

$result = $raw | ConvertFrom-Json
if ($result.sent -eq $true) {
    if ($resolved_message.Length -eq 0) {
        Write-Host '[nabu_try_flush] Meddelande saknas trots sent=true.'
        exit 1
    }
    & (Join-Path $PSScriptRoot 'nabu_send_webhook.ps1') -Message $resolved_message
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
    }
    default {
        Write-Host "[nabu_try_flush] Uppskjuten: $($result.reason)"
    }
}

if ($result.schedule_delayed_flush -eq $true) {
    $delay_seconds = Get-RetryDelaySeconds -Result $result
    Schedule-DelayedFlush -Text $resolved_message -DelaySeconds $delay_seconds
}
exit 0
