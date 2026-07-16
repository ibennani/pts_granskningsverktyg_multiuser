# Skickar klar-notis till Nabu/Galaxy Watch via webhook (uppskjuten tills allt arbete är klart).
# Miljö: NABU_WEBHOOK_URL (obligatorisk).
# NABU_TASK_LABEL (valfri) eller fil .cursor/nabu_task_context.txt

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
$repo_root = Split-Path -Parent $PSScriptRoot
$state_script = Join-Path $PSScriptRoot 'nabu_work_state.mjs'

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

& node $state_script request-notify
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

& (Join-Path $PSScriptRoot 'nabu_try_flush.ps1') -Message $msg
exit $LASTEXITCODE
