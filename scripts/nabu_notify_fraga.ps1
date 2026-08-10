# Skickar fråge-notis till Nabu/Galaxy Watch när användaren ska svara (t.ex. i planläge).
# Miljö: NABU_WEBHOOK_URL (obligatorisk), NABU_QUESTION_SUMMARY (valfri om sammanfattning ges som argument).

param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$SummaryParts
)

function Get-NabuWebhookUrlFromLocalRule {
    $repo_root = Split-Path -Parent $PSScriptRoot
    $path = Join-Path (Join-Path (Join-Path $repo_root '.cursor') 'rules') 'nabu-webhook.local.mdc'
    if (-not (Test-Path -LiteralPath $path)) {
        return $null
    }
    $txt = [System.IO.File]::ReadAllText($path, [System.Text.UTF8Encoding]::new($false))
    foreach ($line in $txt -split "`r?`n") {
        $t = $line.Trim()
        if ($t -match '^https://hooks\.nabu\.casa/\S+$') {
            return $t
        }
    }
    return $null
}

function Get-QuestionSummary {
    param([string[]]$Parts)
    $from_env = $env:NABU_QUESTION_SUMMARY
    if ($from_env -and $from_env.Trim().Length -gt 0) {
        return $from_env.Trim()
    }
    $repo_root = Split-Path -Parent $PSScriptRoot
    $path = Join-Path (Join-Path $repo_root '.cursor') 'nabu_question_context.txt'
    if (Test-Path -LiteralPath $path) {
        $raw = [System.IO.File]::ReadAllText($path, [System.Text.UTF8Encoding]::new($false)).Trim()
        if ($raw.Length -gt 0) {
            return $raw
        }
    }
    $from_args = ($Parts | Where-Object { $_ -and $_.Trim().Length -gt 0 }) -join ' '
    if ($from_args -and $from_args.Trim().Length -gt 0) {
        return $from_args.Trim()
    }
    return ''
}

$ErrorActionPreference = 'Stop'
if (-not $env:NABU_WEBHOOK_URL) {
    $from_file = Get-NabuWebhookUrlFromLocalRule
    if ($from_file) {
        $env:NABU_WEBHOOK_URL = $from_file
    }
}
if (-not $env:NABU_WEBHOOK_URL) {
    Write-Host '[nabu_notify_fraga] Sätt NABU_WEBHOOK_URL eller skapa .cursor/rules/nabu-webhook.local.mdc med webhook-URL på en egen rad.'
    exit 1
}

$summary = Get-QuestionSummary -Parts $SummaryParts
if ($summary.Length -eq 0) {
    Write-Host '[nabu_notify_fraga] Ange kort sammanfattning som argument eller via NABU_QUESTION_SUMMARY.'
    exit 1
}

$max_summary = 200
if ($summary.Length -gt $max_summary) {
    $summary = $summary.Substring(0, $max_summary)
}

# Bygg prefix med Unicode-koder (samma mönster som nabu_notify.ps1) så att Windows PowerShell
# inte dubbelkodar å/ä/ö när skriptfilen läses in via -File.
$aa = [char]0x00E5
$tz = [TimeZoneInfo]::FindSystemTimeZoneById('W. Europe Standard Time')
$stamp = [TimeZoneInfo]::ConvertTimeFromUtc([DateTime]::UtcNow, $tz).ToString('HH:mm:ss')
$msg = ('Du m{0}ste svara p{0} fr{0}gor om {1} ({2})' -f $aa, $summary, $stamp)
& (Join-Path $PSScriptRoot 'nabu_send_webhook.ps1') -Message $msg
exit $LASTEXITCODE
