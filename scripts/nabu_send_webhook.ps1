# Skickar klar-notis till Home Assistant (event cursor_agent_klar) med webhook som reserv.
param(
    [string] $Message = '',
    [string] $MessageFile = '',
    [string] $Typ = 'klar'
)
$ErrorActionPreference = 'Stop'
$utf8 = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = $utf8
$OutputEncoding = $utf8
$repo_root = Split-Path -Parent $PSScriptRoot
$message_path = Join-Path (Join-Path $repo_root '.cursor') 'nabu_flush_message.txt'
$payload_script = Join-Path $PSScriptRoot 'nabu_project_klar_message.mjs'
$event_script = Join-Path $PSScriptRoot 'nabu_ha_cursor_klar_event.mjs'
$fallback_script = Join-Path $PSScriptRoot 'nabu_send_webhook_fallback.mjs'

function Invoke-NotificationPayload {
    param([string] $NotificationTyp)
    $args = @($payload_script, 'ha-payload', $repo_root)
    if ($NotificationTyp -eq 'fraga') {
        $args += 'fraga'
    }
    $json_line = & node @args 2>$null
    if (-not $json_line) {
        return $null
    }
    return $json_line.Trim()
}

function Send-HaCursorKlarEvent {
    param([string] $PayloadJson)
    $payload_tmp = [System.IO.Path]::GetTempFileName()
    try {
        [System.IO.File]::WriteAllText($payload_tmp, $PayloadJson, $utf8)
        & node $event_script --json-file $payload_tmp
        if ($LASTEXITCODE -eq 0) {
            Write-Host '[nabu_send_webhook] Event cursor_agent_klar skickat till Home Assistant.'
            return $true
        }
        Write-Host "[nabu_send_webhook] cursor_agent_klar misslyckades via Node (exit $LASTEXITCODE)."
        return $false
    } catch {
        Write-Host "[nabu_send_webhook] cursor_agent_klar misslyckades: $($_.Exception.Message)"
        return $false
    } finally {
        Remove-Item -LiteralPath $payload_tmp -ErrorAction SilentlyContinue
    }
}

if ($MessageFile.Length -gt 0 -and (Test-Path -LiteralPath $MessageFile)) {
    $Message = [System.IO.File]::ReadAllText($MessageFile, $utf8).Trim()
    $message_path = $MessageFile
}

$payload_json = Invoke-NotificationPayload -NotificationTyp $Typ
if (-not $payload_json) {
    Write-Host '[nabu_send_webhook] Kunde inte bygga notis-payload.'
    exit 1
}

if (Send-HaCursorKlarEvent -PayloadJson $payload_json) {
    if ($Typ -eq 'fraga') {
        $work_state_script = Join-Path $PSScriptRoot 'nabu_work_state.mjs'
        & node $work_state_script mark-notify-sent 2>$null | Out-Null
    }
    exit 0
}

& node $fallback_script $payload_json
exit $LASTEXITCODE
