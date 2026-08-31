[CmdletBinding()]
param(
    [ValidateSet("build", "check", "ask")]
    [string]$Command = "build",

    [string]$Query,

    [string]$Scope
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$package = "@nanonets/graft@0.9.1"

# Structural mode only. `graft build`, `check`, and `ask` do not need a model.
# Clearing common provider keys makes an accidental provider call fail closed.
$env:OPENAI_API_KEY = ""
$env:ANTHROPIC_API_KEY = ""
$env:GEMINI_API_KEY = ""
$env:GOOGLE_API_KEY = ""

$npxArguments = @(
    "--yes",
    "--ignore-scripts",
    "--package=$package",
    "graft",
    $Command
)

if ($Command -eq "ask") {
    if ([string]::IsNullOrWhiteSpace($Query)) {
        throw "-Query is required when -Command is ask."
    }

    $npxArguments += $Query
    if (-not [string]::IsNullOrWhiteSpace($Scope)) {
        $npxArguments += @("--in", $Scope)
    }
}

$npxArguments += $repoRoot

Write-Host "Graft $Command (structural-only, $package)"
& npx @npxArguments
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}
