# Sparar fråge-sammanfattning som UTF-8 och skickar fråge-notis till Nabu.
# Används av notify_question.cmd i projektroten.
param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]] $Rest
)

$ErrorActionPreference = 'Stop'

$summary_from_args = ($Rest | Where-Object { $_ -and $_.Trim().Length -gt 0 }) -join ' '
$summary_from_args = $summary_from_args.Trim()
if ($summary_from_args.Length -gt 0) {
    $repo_root = Split-Path -Parent $PSScriptRoot
    $cursor_dir = Join-Path $repo_root '.cursor'
    if (-not (Test-Path -LiteralPath $cursor_dir)) {
        New-Item -ItemType Directory -Path $cursor_dir | Out-Null
    }
    $max = 200
    if ($summary_from_args.Length -gt $max) {
        $summary_from_args = $summary_from_args.Substring(0, $max)
    }
    $path = Join-Path $cursor_dir 'nabu_question_context.txt'
    [System.IO.File]::WriteAllText($path, $summary_from_args, [System.Text.UTF8Encoding]::new($false))
}

& (Join-Path $PSScriptRoot 'nabu_notify_fraga.ps1')
exit $LASTEXITCODE
