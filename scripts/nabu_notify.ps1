# Skickar klar-notis till Nabu/Galaxy Watch via webhook.
# Miljö: NABU_WEBHOOK_URL (obligatorisk).
# NABU_TASK_LABEL (valfri) eller fil .cursor/nabu_task_context.txt

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

function Get-NabuTaskLabel {
    $from_env = $env:NABU_TASK_LABEL
    if ($from_env -and $from_env.Trim().Length -gt 0) {
        return $from_env.Trim()
    }
    $repo_root = Split-Path -Parent $PSScriptRoot
    $path = Join-Path (Join-Path $repo_root '.cursor') 'nabu_task_context.txt'
    if (-not (Test-Path -LiteralPath $path)) {
        return ''
    }
    $raw = [System.IO.File]::ReadAllText($path, [System.Text.UTF8Encoding]::new($false)).Trim()
    if ($raw.Length -eq 0) {
        return ''
    }
    return $raw
}

$ErrorActionPreference = 'Stop'
if (-not $env:NABU_WEBHOOK_URL) {
    $from_file = Get-NabuWebhookUrlFromLocalRule
    if ($from_file) {
        $env:NABU_WEBHOOK_URL = $from_file
    }
}
if (-not $env:NABU_WEBHOOK_URL) {
    Write-Host '[nabu_notify] Sätt NABU_WEBHOOK_URL eller skapa .cursor/rules/nabu-webhook.local.mdc med webhook-URL på en egen rad.'
    exit 1
}
$task = Get-NabuTaskLabel
$max_task = 200
if ($task.Length -gt $max_task) {
    $task = $task.Substring(0, $max_task)
}
# Alltid börja med «Nu är jag klar» så Home Assistant-/Nabu-automationer som lyssnar på den frasen fortsätter fungera.
$em = [char]0x2014
$a = [char]0x00E4
if ($task.Length -gt 0) {
    $msg = ('Nu {0}r jag klar {1} {2}' -f $a, $em, $task)
} else {
    $msg = ('Nu {0}r jag klar' -f $a)
}
$body = @{ message = $msg } | ConvertTo-Json -Compress
$tmp = [System.IO.Path]::GetTempFileName()
try {
    [System.IO.File]::WriteAllText($tmp, $body, [System.Text.UTF8Encoding]::new($false))
    $curl = Get-Command curl.exe -ErrorAction SilentlyContinue
    if (-not $curl) {
        Write-Host '[nabu_notify] Hittar inte curl.exe (krävs i PATH, t.ex. Windows 10+).'
        exit 1
    }
    $data_arg = '@' + $tmp
    & curl.exe -s -X POST -H 'Content-Type: application/json; charset=utf-8' --data-binary $data_arg $env:NABU_WEBHOOK_URL
    exit $LASTEXITCODE
} finally {
    Remove-Item -LiteralPath $tmp -ErrorAction SilentlyContinue
}
