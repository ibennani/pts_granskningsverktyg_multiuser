# Sparar kort uppgiftsbeskrivning för Nabu-notiser (läses av nabu_notify.ps1).
param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]] $Rest
)
$ErrorActionPreference = 'Stop'
$repo_root = Split-Path -Parent $PSScriptRoot
$cursor_dir = Join-Path $repo_root '.cursor'
if (-not (Test-Path -LiteralPath $cursor_dir)) {
    New-Item -ItemType Directory -Path $cursor_dir | Out-Null
}
$line = ($Rest -join ' ').Trim()
if ($line.Length -eq 0) {
    Write-Host '[set_nabu_task] Ange en kort beskrivning, t.ex. scripts\set_nabu_task.cmd Granskar API-klienten'
    exit 1
}
$max = 200
if ($line.Length -gt $max) {
    $line = $line.Substring(0, $max)
}
$path = Join-Path $cursor_dir 'nabu_task_context.txt'
[System.IO.File]::WriteAllText($path, $line, [System.Text.UTF8Encoding]::new($false))
exit 0
