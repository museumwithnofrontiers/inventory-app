#Requires -Version 7.0
<#
.SYNOPSIS
    Run one PHP check (Pint, PHPStan or the tests) on a checkout, from a copy of its files in a Docker volume.

.DESCRIPTION
    Docker Desktop on Windows reads a bind-mounted Windows folder through the WSL2 VM's file share
    (the load shows as `vmmem`). That share is slow for the thousands of small PHP files Laravel
    loads on every test. Measured on 4 CPUs, 2026-11-19:
      - 10 Filament tests: 152 s from the bind mount, 13 s from a volume;
      - the whole suite: about 55 min from the bind mount, 7.5 min from a volume.

    So this script never bind-mounts the checkout. It:
      1. copies the files git knows about (tracked and untracked, not ignored, without node_modules)
         into a volume of the checkout's own, with the host's tar: about 10 to 20 s;
      2. runs the one check in the dev image against that volume. Vendor lives in its own volume,
         installed with `composer install` the first time;
      3. keeps PHPStan's result cache in a volume, so a re-run only analyses what changed.

    Each check has its own source volume, so Pint, PHPStan and the tests can run at the same time
    as separate tasks. The copy is one-way: Pint runs with --test, so fix style on the checkout
    itself (`vendor/bin/pint`, or `scripts/Invoke-Fix.ps1`).

.PARAMETER Check
    pint, phpstan or tests.

.PARAMETER Path
    The checkout to check. Default: this repository.

.PARAMETER Tests
    For -Check tests: the test files or directories to run. Default: the whole suite, in parallel.

.PARAMETER Image
    The dev image (`docker build --target dev -f .docker/Dockerfile -t inventory-app:dev .`).

.PARAMETER VendorVolume
    The volume that holds vendor/. Shared by every checkout with the same composer.lock.

.EXAMPLE
    .\scripts\Invoke-VolumeCheck.ps1 -Check tests
    .\scripts\Invoke-VolumeCheck.ps1 -Check tests -Tests tests/Filament/RelationManagers
    .\scripts\Invoke-VolumeCheck.ps1 -Check phpstan -Path C:\worktrees\my-branch
#>
param(
    [Parameter(Mandatory)]
    [ValidateSet('pint', 'phpstan', 'tests')]
    [string]$Check,

    [string]$Path = (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Definition)),

    [string[]]$Tests = @(),

    [string]$Image = 'inventory-app:dev',

    [string]$VendorVolume = 'inventory-php-vendor'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Path = (Resolve-Path $Path).Path
$leaf = (Split-Path -Leaf $Path).ToLowerInvariant() -replace '[^a-z0-9_.-]', '-'
$sourceVolume = "php-src-$leaf-$Check"
$cacheVolume = "php-phpstan-cache-$leaf"
$started = Get-Date

# 1. Copy the checkout into its volume, with the host's tar (it reads NTFS directly).
$list = Join-Path ([IO.Path]::GetTempPath()) "php-check-$leaf-$Check.txt"
Push-Location $Path
try {
    git ls-files -co --exclude-standard |
        Where-Object { $_ -notmatch '(^|/)node_modules/' -and (Test-Path -LiteralPath $_ -PathType Leaf) } |
        Set-Content -Encoding ascii $list
    cmd /c "tar -cf - -T `"$list`" | docker run --rm -i -v ${sourceVolume}:/dst alpine sh -c `"find /dst -mindepth 1 -maxdepth 1 -exec rm -rf {} + ; tar xf - -C /dst`""
    if ($LASTEXITCODE -ne 0) { throw "Copying $Path into $sourceVolume failed ($LASTEXITCODE)" }
}
finally {
    Pop-Location
    Remove-Item $list -ErrorAction SilentlyContinue
}
Write-Host "[$Check] copied $Path in $([int]((Get-Date) - $started).TotalSeconds) s"

# 2. Run the check. A throwaway APP_KEY: the tests need one, and none is read from a .env.
$key = 'base64:' + [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
$command = switch ($Check) {
    'pint' { 'vendor/bin/pint --test' }
    'phpstan' { 'vendor/bin/phpstan analyse --no-progress --memory-limit=2G' }
    'tests' {
        if ($Tests.Count -gt 0) { 'php artisan test --compact ' + ($Tests -join ' ') }
        else { 'php artisan test --compact --parallel' }
    }
}
$install = 'test -f vendor/autoload.php || composer install --no-interaction --no-progress --prefer-dist'

$run = Get-Date
docker run --rm --entrypoint sh -e "APP_KEY=$key" `
    -v "${sourceVolume}:/var/www/app" -v "${VendorVolume}:/var/www/app/vendor" -v "${cacheVolume}:/tmp/phpstan" `
    -w /var/www/app $Image -c "$install && $command 2>&1"
$code = $LASTEXITCODE
Write-Host "[$Check] exit $code, ran in $([int]((Get-Date) - $run).TotalSeconds) s, $([int]((Get-Date) - $started).TotalSeconds) s in all"
exit $code
