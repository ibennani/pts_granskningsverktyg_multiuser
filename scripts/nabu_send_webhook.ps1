# Skickar JSON-meddelande till Home Assistant-webhook (primärt) eller Nabu-fallback.
param(
    [Parameter(Mandatory = $true)]
    [string] $Message
)
$ErrorActionPreference = 'Stop'
$repo_root = Split-Path -Parent $PSScriptRoot
$rule_path = Join-Path (Join-Path (Join-Path $repo_root '.cursor') 'rules') 'nabu-webhook.local.mdc'

function Get-LocalRuleText {
    if (-not (Test-Path -LiteralPath $rule_path)) {
        return ''
    }
    return [System.IO.File]::ReadAllText($rule_path, [System.Text.UTF8Encoding]::new($false))
}

function Get-NabuHooksUrl {
    if ($env:NABU_WEBHOOK_URL -and $env:NABU_WEBHOOK_URL.Trim().Length -gt 0) {
        return $env:NABU_WEBHOOK_URL.Trim()
    }
    $txt = Get-LocalRuleText
    foreach ($line in $txt -split "`r?`n") {
        $t = $line.Trim()
        if ($t -match '^https://hooks\.nabu\.casa/\S+$') {
            return $t
        }
    }
    return $null
}

function Get-WebhookIdFromUrl {
    param([string] $Url)
    if ($Url -match 'hooks\.nabu\.casa/(\S+)$') {
        return $Matches[1]
    }
    if ($Url -match '/api/webhook/(\S+)$') {
        return $Matches[1]
    }
    return $null
}

function Get-HaWebhookBaseUrl {
    if ($env:HA_WEBHOOK_BASE_URL -and $env:HA_WEBHOOK_BASE_URL.Trim().Length -gt 0) {
        return $env:HA_WEBHOOK_BASE_URL.Trim().TrimEnd('/')
    }
    $txt = Get-LocalRuleText
    foreach ($line in $txt -split "`r?`n") {
        $t = $line.Trim()
        if ($t -match '^HA_WEBHOOK_BASE_URL=(\S+)$') {
            return $Matches[1].TrimEnd('/')
        }
        if ($t -match '^(https://[a-z0-9]+\.ui\.nabu\.casa)$') {
            return $Matches[1]
        }
    }
    return $null
}

function Resolve-WebhookTargets {
    $hooks_url = Get-NabuHooksUrl
    if (-not $hooks_url) {
        return @()
    }
    $webhook_id = Get-WebhookIdFromUrl -Url $hooks_url
    if (-not $webhook_id) {
        return @($hooks_url)
    }
    $targets = @()
    $ha_base = Get-HaWebhookBaseUrl
    if ($ha_base) {
        $targets += "$ha_base/api/webhook/$webhook_id"
    }
    if ($hooks_url -notin $targets) {
        $targets += $hooks_url
    }
    return $targets
}

$targets = Resolve-WebhookTargets
if ($targets.Count -eq 0) {
    Write-Host '[nabu_send_webhook] Sätt NABU_WEBHOOK_URL och HA_WEBHOOK_BASE_URL, eller fyll i .cursor/rules/nabu-webhook.local.mdc.'
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
    $sent = $false
    foreach ($url in $targets) {
        & curl.exe -s -S -f -X POST -H 'Content-Type: application/json; charset=utf-8' --data-binary $data_arg $url
        if ($LASTEXITCODE -eq 0) {
            $sent = $true
            if ($url -match '\.ui\.nabu\.casa/api/webhook/') {
                Write-Host '[nabu_send_webhook] Webhook skickad via Home Assistant.'
            } else {
                Write-Host '[nabu_send_webhook] Webhook skickad via Nabu-fallback.'
            }
            exit 0
        }
        Write-Host "[nabu_send_webhook] Misslyckades mot $url (exit $LASTEXITCODE)."
    }
    if (-not $sent) {
        Write-Host '[nabu_send_webhook] Alla webhook-mål misslyckades.'
        exit 1
    }
} finally {
    Remove-Item -LiteralPath $tmp -ErrorAction SilentlyContinue
}
