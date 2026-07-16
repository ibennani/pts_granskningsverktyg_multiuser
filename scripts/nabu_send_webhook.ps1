# Skickar JSON-meddelande till Nabu-webhook via curl.
param(
    [Parameter(Mandatory = $true)]
    [string] $Message
)
$ErrorActionPreference = 'Stop'

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

if (-not $env:NABU_WEBHOOK_URL) {
    $from_file = Get-NabuWebhookUrlFromLocalRule
    if ($from_file) {
        $env:NABU_WEBHOOK_URL = $from_file
    }
}
if (-not $env:NABU_WEBHOOK_URL) {
    Write-Host '[nabu_send_webhook] Sätt NABU_WEBHOOK_URL eller skapa .cursor/rules/nabu-webhook.local.mdc med webhook-URL.'
    exit 1
}

$body = @{ message = $Message } | ConvertTo-Json -Compress
$tmp = [System.IO.Path]::GetTempFileName()
try {
    [System.IO.File]::WriteAllText($tmp, $body, [System.Text.UTF8Encoding]::new($false))
    $curl = Get-Command curl.exe -ErrorAction SilentlyContinue
    if (-not $curl) {
        Write-Host '[nabu_send_webhook] Hittar inte curl.exe (krävs i PATH, t.ex. Windows 10+).'
        exit 1
    }
    $data_arg = '@' + $tmp
    & curl.exe -s -X POST -H 'Content-Type: application/json; charset=utf-8' --data-binary $data_arg $env:NABU_WEBHOOK_URL
    exit $LASTEXITCODE
} finally {
    Remove-Item -LiteralPath $tmp -ErrorAction SilentlyContinue
}
