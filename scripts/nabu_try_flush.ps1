# Försöker skicka uppskjuten klar-notis om arbetskön är tom.
param(
    [string] $Message = ''
)
$ErrorActionPreference = 'Stop'
$repo_root = Split-Path -Parent $PSScriptRoot
$state_script = Join-Path $PSScriptRoot 'nabu_work_state.mjs'
$message_path = Join-Path (Join-Path $repo_root '.cursor') 'nabu_flush_message.txt'
$sync_flush_max_ms = 25000

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
    return 3
}

function Invoke-TryFlush {
    try {
        $raw = & node $state_script try-flush 2>&1
        if (-not $raw) {
            return $null
        }
        $json_line = ($raw | Out-String).Trim().Split([Environment]::NewLine) | Where-Object { $_.Trim().StartsWith('{') } | Select-Object -Last 1
        if (-not $json_line) {
            return $null
        }
        return $json_line | ConvertFrom-Json
    } catch {
        Write-Host "[nabu_try_flush] try-flush misslyckades: $($_.Exception.Message)"
        return $null
    }
}

function Write-DeferredReason {
    param($Result)
    switch ($Result.reason) {
        'no_request' {
            Write-Host '[nabu_try_flush] Ingen begärd klar-notis.'
        }
        'pending_subagents' {
            Write-Host "[nabu_try_flush] Uppskjuten: $($Result.count) underagent(er) kör fortfarande."
        }
        'open_todos' {
            Write-Host "[nabu_try_flush] Uppskjuten: $($Result.count) öppen(a) todo(s)."
        }
        'debounce' {
            Write-Host "[nabu_try_flush] Uppskjuten: debounce (väntar $($Result.wait_ms) ms)."
        }
        default {
            Write-Host "[nabu_try_flush] Uppskjuten: $($Result.reason)"
        }
    }
}

function Send-FlushWebhook {
    param([string] $Text)
    if ($Text.Length -eq 0) {
        Write-Host '[nabu_try_flush] Meddelande saknas trots sent=true.'
        return 1
    }
    & (Join-Path $PSScriptRoot 'nabu_send_webhook.ps1') -Message $Text
    $exit_code = $LASTEXITCODE
    if ($exit_code -ne 0) {
        & node $state_script requeue-notify | Out-Null
        Write-Host '[nabu_try_flush] Webhook misslyckades; klar-notis återköad.'
    } else {
        & node $state_script mark-notify-sent | Out-Null
        Write-Host '[nabu_try_flush] Klar-notis skickad.'
    }
    return $exit_code
}

$resolved_message = Read-FlushMessage
if ($Message.Length -gt 0) {
    Save-FlushMessage -Text $Message
    $resolved_message = $Message
}

$deadline = [DateTime]::UtcNow.AddMilliseconds($sync_flush_max_ms)
$result = Invoke-TryFlush

while ($result.sent -ne $true -and [DateTime]::UtcNow -lt $deadline) {
    if ($null -eq $result -or $result.reason -eq 'no_request') {
        break
    }
    Write-DeferredReason -Result $result
    $delay_seconds = Get-RetryDelaySeconds -Result $result
    Start-Sleep -Seconds $delay_seconds
    $result = Invoke-TryFlush
}

if ($null -eq $result) {
    Write-Host '[nabu_try_flush] Klar-notis kunde inte verifieras; försök notify_done.cmd igen.'
    exit 1
}

if ($result.sent -eq $true) {
    exit (Send-FlushWebhook -Text $resolved_message)
}

Write-DeferredReason -Result $result
Write-Host '[nabu_try_flush] Klar-notis kunde inte skickas inom tidsgränsen; försök notify_done.cmd igen.'
exit 1
