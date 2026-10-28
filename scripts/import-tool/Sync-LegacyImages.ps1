<#
    .SYNOPSIS
        Mirror legacy's image tree into the local copy that `stage` reads.
    .DESCRIPTION
        `stage` copies legacy images from LEGACY_IMAGES_HOST_PATH, a local copy
        of the image tree on the legacy server. Docker Desktop cannot mount the
        server's share itself. Pictures added on legacy after the last mirror
        are missing from that copy, so image-sync reports them as "Legacy image
        not found". Run this before every stage.

        The mirror is exact (robocopy /MIR): files deleted on legacy are deleted
        from the copy too, as stage must not import a picture legacy no longer
        has.

        Both paths come from scripts/import-tool/.env:
        LEGACY_IMAGES_SOURCE (the server's image tree, over the VPN) and
        LEGACY_IMAGES_HOST_PATH (the copy). The log lists every file copied
        or deleted, so a run answers which pictures are new.
    .PARAMETER EnvFile
        The import tool's .env. Defaults to the one next to this script.
    .PARAMETER Source
        Overrides LEGACY_IMAGES_SOURCE, e.g. to mirror one subtree.
    .PARAMETER Destination
        Overrides LEGACY_IMAGES_HOST_PATH. Must be the same subtree as -Source.
    .PARAMETER LogPath
        Defaults to logs/sync-legacy-images-<timestamp>.log next to this script.
    .PARAMETER ListOnly
        Report what would be copied or deleted, and change nothing (robocopy /L).
    .EXAMPLE
        ./scripts/import-tool/Sync-LegacyImages.ps1 -ListOnly
    .EXAMPLE
        ./scripts/import-tool/Sync-LegacyImages.ps1
#>
[CmdletBinding()]
param(
    [string]$EnvFile = (Join-Path $PSScriptRoot '.env'),

    [string]$Source,

    [string]$Destination,

    [string]$LogPath,

    [switch]$ListOnly
)
$ErrorActionPreference = 'Stop'

function Read-EnvValue([string]$Path, [string]$Name) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $null }
    foreach ($line in Get-Content -LiteralPath $Path) {
        if ($line -match "^\s*$([regex]::Escape($Name))\s*=\s*(.*?)\s*$") {
            # Compose reads this file too: a single-quoted value is literal there,
            # which is how a UNC path keeps the `$` of an administrative share.
            return $Matches[1] -replace "^'(.*)'$", '$1' -replace '^"(.*)"$', '$1'
        }
    }
    return $null
}

if (-not $Source) { $Source = Read-EnvValue $EnvFile 'LEGACY_IMAGES_SOURCE' }
if (-not $Destination) { $Destination = Read-EnvValue $EnvFile 'LEGACY_IMAGES_HOST_PATH' }
if (-not $Source -or -not $Destination) {
    throw "Set LEGACY_IMAGES_SOURCE and LEGACY_IMAGES_HOST_PATH in $EnvFile, or pass -Source and -Destination."
}
if (-not (Test-Path -LiteralPath $Source -PathType Container)) {
    throw "Legacy image tree not reachable: $Source (is the VPN up?)"
}
if (-not $LogPath) {
    $logDir = Join-Path $PSScriptRoot 'logs'
    New-Item -ItemType Directory -Force -Path $logDir | Out-Null
    $LogPath = Join-Path $logDir ("sync-legacy-images-{0:yyyyMMdd-HHmmss}.log" -f (Get-Date))
}

# /NDL keeps directories out of the log. Files stay in it: robocopy logs only
# the ones it copies, deletes or fails on, which is exactly what changed.
$options = @('/MIR', '/XF', 'Thumbs.db', '.DS_Store', '/R:3', '/W:5', '/NDL', '/NP', "/LOG:$LogPath")
if ($ListOnly) { $options += '/L' }

Write-Host "Mirroring $Source -> $Destination$(if ($ListOnly) { ' (list only)' })"
& robocopy $Source $Destination @options
$code = $LASTEXITCODE

# robocopy's exit code is a bit field: below 8 means every file was handled
# (1 copied, 2 extras deleted, 4 mismatches), 8 and above means failures.
$new = @(Select-String -LiteralPath $LogPath -Pattern '^\s*(New File|Nouveau fichier)\s' -ErrorAction SilentlyContinue).Count
$gone = @(Select-String -LiteralPath $LogPath -Pattern '^\s*\*(EXTRA File|Fichier SUPPL\.)\s' -ErrorAction SilentlyContinue).Count
Write-Host "$new new file(s), $gone deleted on legacy. Log: $LogPath"
if ($code -ge 8) {
    Write-Error "robocopy reported failures (exit code $code); see $LogPath"
    exit $code
}
exit 0
