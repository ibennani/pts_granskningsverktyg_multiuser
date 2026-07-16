# Sparar kort sammanfattning för fråge-notiser (läses av nabu_notify_fraga.ps1).
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
    Write-Host '[set_nabu_question] Ange kort sammanfattning, t.ex. scripts\set_nabu_question.cmd om planen ska uppdateras'
    exit 1
}
$max = 200
if ($line.Length -gt $max) {
    $line = $line.Substring(0, $max)
}
$path = Join-Path $cursor_dir 'nabu_question_context.txt'
[System.IO.File]::WriteAllText($path, $line, [System.Text.UTF8Encoding]::new($false))
exit 0
