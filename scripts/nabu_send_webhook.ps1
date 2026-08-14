# Skickar klar-notis till Home Assistant (event cursor_agent_klar) med webhook som reserv.
param(
    [Parameter(Mandatory = $true)]
    [string] $Message
)
$ErrorActionPreference = 'Stop'
$repo_root = Split-Path -Parent $PSScriptRoot
$rule_path = Join-Path (Join-Path (Join-Path $repo_root '.cursor') 'rules') 'nabu-webhook.local.mdc'
$generic_beskrivning = 'Öppna Cursor och läs senaste svaret.'

function Get-LocalRuleText {
    if (-not (Test-Path -LiteralPath $rule_path)) {
        return ''
    }
    return [System.IO.File]::ReadAllText($rule_path, [System.Text.UTF8Encoding]::new($false))
}

function Get-HaEnvFallbackPath {
    $kod_root = Split-Path (Split-Path $repo_root -Parent) -Parent
    return Join-Path (Join-Path $kod_root 'home_assistant') '.env'
}

function Get-EnvVariable {
    param([string] $Key)
    return [System.Environment]::GetEnvironmentVariable($Key)
}

function Get-HaEnvValue {
    param([string] $Key)
    $from_env = Get-EnvVariable -Key $Key
    if ($from_env -and $from_env.Trim().Length -gt 0) {
        return $from_env.Trim()
    }
    $txt = Get-LocalRuleText
    foreach ($line in $txt -split "`r?`n") {
        $t = $line.Trim()
        if ($t -match "^$([regex]::Escape($Key))=(.*)$") {
            return $Matches[1].Trim().Trim('"').Trim("'")
        }
    }
    $fallback_path = Get-HaEnvFallbackPath
    if (-not (Test-Path -LiteralPath $fallback_path)) {
        return ''
    }
    foreach ($line in ([System.IO.File]::ReadAllText($fallback_path, [System.Text.UTF8Encoding]::new($false)) -split "`r?`n")) {
        $t = $line.Trim()
        if ($t -match "^$([regex]::Escape($Key))=(.*)$") {
            return $Matches[1].Trim().Trim('"').Trim("'")
        }
    }
    return ''
}

function Get-NabuHooksUrl {
    $from_env = Get-EnvVariable -Key 'NABU_WEBHOOK_URL'
    if ($from_env -and $from_env.Trim().Length -gt 0) {
        return $from_env.Trim()
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
    $from_env = Get-EnvVariable -Key 'HA_WEBHOOK_BASE_URL'
    if ($from_env -and $from_env.Trim().Length -gt 0) {
        return $from_env.Trim().TrimEnd('/')
    }
    $txt = Get-LocalRuleText
    foreach ($line in $txt -split "`r?`n") {
        $t = $line.Trim()
        if ($t -match '^HA_WEBHOOK_BASE_URL=(\S+)$') {
            return $Matches[1].TrimEnd('/')
        }
        if ($t -match '^(https://[a-z0-9]+\.ui\.nabu\.casa)$') {
            return $Matches[0]
        }
    }
    return $null
}

function Get-HaApiUrls {
    $urls = @()
    foreach ($key in @('HA_URL_REMOTE', 'HA_URL')) {
        $value = Get-HaEnvValue -Key $key
        if ($value -and $value -notin $urls) {
            $urls += $value.TrimEnd('/')
        }
    }
    $ha_base = Get-HaWebhookBaseUrl
    if ($ha_base -and $ha_base -notin $urls) {
        $urls += $ha_base
    }
    return $urls
}

function Get-WebhookPayloadBeskrivning {
    param([string] $Message)
    $em = [char]0x2014
    $a = [char]0x00E4
    $klar_prefix = ('Nu {0}r jag klar' -f $a)
    $fraga_prefix = ('Du m{0}ste svara p{0} fr{0}gor om ' -f $a)
    if ($Message.StartsWith($fraga_prefix)) {
        return $Message
    }
    if ($Message.StartsWith($klar_prefix)) {
        $tail = $Message.Substring($klar_prefix.Length).Trim()
        if ($tail.StartsWith($em)) {
            $task = $tail.Substring(1).Trim()
            if ($task.Length -gt 0) {
                return $task
            }
        } elseif ($tail.Length -gt 0) {
            return $tail
        }
        return 'Agenten är klar'
    }
    return $Message
}

function Should-SkipBeskrivning {
    param([string] $Beskrivning)
    $trimmed = $Beskrivning.Trim()
    return ($trimmed.Length -eq 0) -or ($trimmed -eq $generic_beskrivning)
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

function Send-HaCursorKlarEvent {
    param([string] $Beskrivning)
    $ha_token = Get-HaEnvValue -Key 'HA_TOKEN'
    $ha_urls = Get-HaApiUrls
    if (-not $ha_token -or $ha_urls.Count -eq 0) {
        Write-Host '[nabu_send_webhook] HA_TOKEN eller HA_URL saknas — hoppar över cursor_agent_klar.'
        return $false
    }
    $curl = Get-Command curl.exe -ErrorAction SilentlyContinue
    if (-not $curl) {
        Write-Host '[nabu_send_webhook] Hittar inte curl.exe.'
        return $false
    }
    $event_body = @{ beskrivning = $Beskrivning } | ConvertTo-Json -Compress
    $event_tmp = [System.IO.Path]::GetTempFileName()
    try {
        [System.IO.File]::WriteAllText($event_tmp, $event_body, [System.Text.UTF8Encoding]::new($false))
        $data_arg = '@' + $event_tmp
        foreach ($ha_url in $ha_urls) {
            $event_url = "$ha_url/api/events/cursor_agent_klar"
            & curl.exe -s -S -f -m 20 -X POST `
                -H "Authorization: Bearer $ha_token" `
                -H 'Content-Type: application/json; charset=utf-8' `
                --data-binary $data_arg `
                $event_url
            if ($LASTEXITCODE -eq 0) {
                Write-Host '[nabu_send_webhook] Event cursor_agent_klar skickat till Home Assistant.'
                return $true
            }
            Write-Host "[nabu_send_webhook] cursor_agent_klar misslyckades mot $event_url (exit $LASTEXITCODE)."
        }
        return $false
    } finally {
        Remove-Item -LiteralPath $event_tmp -ErrorAction SilentlyContinue
    }
}

function Send-WebhookFallback {
    param(
        [string] $Message,
        [string] $Beskrivning,
        [string[]] $Targets
    )
    if ($Targets.Count -eq 0) {
        Write-Host '[nabu_send_webhook] Ingen webhook-URL — klar-notis kunde inte skickas.'
        return 1
    }
    $body = @{ message = $Message; beskrivning = $Beskrivning } | ConvertTo-Json -Compress
    $tmp = [System.IO.Path]::GetTempFileName()
    try {
        [System.IO.File]::WriteAllText($tmp, $body, [System.Text.UTF8Encoding]::new($false))
        $data_arg = '@' + $tmp
        foreach ($url in $Targets) {
            & curl.exe -s -S -f -m 20 -X POST -H 'Content-Type: application/json; charset=utf-8' --data-binary $data_arg $url
            if ($LASTEXITCODE -eq 0) {
                if ($url -match '\.ui\.nabu\.casa/api/webhook/') {
                    Write-Host '[nabu_send_webhook] Webhook skickad via Home Assistant (reserv).'
                } else {
                    Write-Host '[nabu_send_webhook] Webhook skickad via Nabu-fallback (reserv).'
                }
                return 0
            }
            Write-Host "[nabu_send_webhook] Webhook misslyckades mot $url (exit $LASTEXITCODE)."
        }
        Write-Host '[nabu_send_webhook] Alla webhook-mål misslyckades.'
        return 1
    } finally {
        Remove-Item -LiteralPath $tmp -ErrorAction SilentlyContinue
    }
}

$beskrivning = Get-WebhookPayloadBeskrivning -Message $Message
if (-not (Should-SkipBeskrivning -Beskrivning $beskrivning)) {
    if (Send-HaCursorKlarEvent -Beskrivning $beskrivning) {
        exit 0
    }
}

$targets = Resolve-WebhookTargets
exit (Send-WebhookFallback -Message $Message -Beskrivning $beskrivning -Targets $targets)
