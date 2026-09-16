#!/usr/bin/env pwsh
<#
.SYNOPSIS
    Test migrations with different .env configurations

.DESCRIPTION
    Runs migrate and rollback cycles twice in a row. Optionally accepts a list of .env files
    to test against different database configurations.

.PARAMETER EnvFiles
    Optional array of .env files to test. If empty, uses current .env configuration.
    Each file will be copied to .env for testing, then restored.

.PARAMETER Cycles
    Number of migrate/rollback cycles to run (default: 2)

.PARAMETER Force
    Force execution even if .env.backup exists

.EXAMPLE
    .\test-migrations.ps1 -Verbose
    # Uses current .env configuration with verbose output

.EXAMPLE
    .\test-migrations.ps1 -EnvFiles @(".env.sqlite", ".env.mariadb") -Verbose
    # Tests with SQLite and MariaDB configurations with verbose output

.EXAMPLE
    .\test-migrations.ps1 -EnvFiles @(".env.sqlite") -WhatIf
    # Shows what would be done without executing
#>

[CmdletBinding(SupportsShouldProcess, ConfirmImpact = 'Medium')]
param(
    [string[]]$EnvFiles = @(),
    [int]$Cycles = 2,
    [switch]$Force
)

# Ensure we're in the right directory
Set-Location $PSScriptRoot\..

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

function Write-Status {
    param([string]$Message, [string]$Color = "Green")
    Write-Host "==> $Message" -ForegroundColor $Color
    Write-Verbose $Message
}

function Write-Error-Status {
    param([string]$Message)
    Write-Host "==> ERROR: $Message" -ForegroundColor Red
    Write-Error $Message
}

function Backup-EnvFile {
    if (Test-Path ".env") {
        if ((Test-Path ".env.backup") -and -not $Force) {
            throw ".env.backup already exists. Use -Force to overwrite, or remove it manually."
        }
        
        if ($PSCmdlet.ShouldProcess(".env", "Backup to .env.backup")) {
            Copy-Item ".env" ".env.backup" -Force
            Write-Status "Backed up .env to .env.backup"
            return $true
        }
    }
    return $false
}

function Restore-EnvFile {
    # Restoration is never blocked by WhatIf/Confirm as it's a safety operation
    if (Test-Path ".env.backup") {
        Copy-Item ".env.backup" ".env" -Force
        if ($PSCmdlet.ShouldProcess(".env.backup", "Remove backup file")) {
            Remove-Item ".env.backup" -Force
        }
        Write-Status "Restored .env from backup"
    }
}

function Test-MigrationCycle {
    param([int]$CycleNumber)
    
    Write-Status "Starting migration cycle $CycleNumber" "Cyan"
    
    if ($PSCmdlet.ShouldProcess("Database", "Wipe and run migration cycle $CycleNumber")) {
        # Wipe database
        Write-Status "Wiping database..."
        $wipeResult = & docker compose run --rm app php artisan db:wipe *>&1
        if ($LASTEXITCODE -ne 0) {
            throw "Database wipe failed:`n$($wipeResult -join "`n")"
        }
        Write-Information "Database wipe output:`n$($wipeResult -join "`n")" -InformationAction Continue
        
        # Run migrations
        Write-Status "Running migrations..."
        $migrateResult = & docker compose run --rm app php artisan migrate *>&1
        if ($LASTEXITCODE -ne 0) {
            throw "Migrations failed:`n$($migrateResult -join "`n")"
        }
        Write-Information "Migration output:`n$($migrateResult -join "`n")" -InformationAction Continue
        
        # Rollback migrations
        Write-Status "Rolling back migrations..."
        $rollbackResult = & docker compose run --rm app php artisan migrate:rollback --step=100 *>&1
        if ($LASTEXITCODE -ne 0) {
            throw "Rollback failed:`n$($rollbackResult -join "`n")"
        }
        Write-Information "Rollback output:`n$($rollbackResult -join "`n")" -InformationAction Continue
        
        Write-Status "Migration cycle $CycleNumber completed successfully" "Green"
    }
}

function Test-WithEnvFile {
    param([string]$EnvFile)
    
    Write-Status "Testing with configuration: $EnvFile" "Yellow"
    
    if (-not (Test-Path $EnvFile)) {
        throw "Environment file not found: $EnvFile"
    }
    
    # Backup current .env and copy new one
    $hasBackup = Backup-EnvFile
    
    try {
        if ($PSCmdlet.ShouldProcess(".env", "Copy $EnvFile to .env")) {
            Copy-Item $EnvFile ".env" -Force
            Write-Status "Switched to configuration: $EnvFile"
        }
        
        # Run all cycles for this configuration
        for ($i = 1; $i -le $Cycles; $i++) {
            Test-MigrationCycle -CycleNumber $i
        }
        
        Write-Status "All cycles completed successfully for $EnvFile" "Green"
        
    } catch {
        Write-Error-Status "Migration testing failed for ${EnvFile}: $_"
        throw $_
    } finally {
        # Always restore original .env (never blocked by WhatIf/Confirm)
        if ($hasBackup) {
            Restore-EnvFile
        }
    }
}

function Test-WithCurrentEnv {
    Write-Status "Testing with current .env configuration" "Yellow"
    
    # Run all cycles with current configuration
    for ($i = 1; $i -le $Cycles; $i++) {
        Test-MigrationCycle -CycleNumber $i
    }
    
    Write-Status "All cycles completed successfully with current configuration" "Green"
}

# Main execution
try {
    Write-Status "Starting migration testing with $Cycles cycles" "Cyan"
    Write-Status "Migration test started at $(Get-Date)"
    
    if ($EnvFiles.Count -eq 0) {
        # Test with current configuration
        Test-WithCurrentEnv
    } else {
        # Test with each provided .env file
        foreach ($envFile in $EnvFiles) {
            Test-WithEnvFile -EnvFile $envFile
        }
    }
    
    Write-Status "All migration tests completed successfully!" "Green"
    Write-Status "Migration test completed at $(Get-Date)"
    
} catch {
    Write-Error-Status "Migration testing failed: $_"
    
    # Ensure .env is restored in case of error
    if (Test-Path ".env.backup") {
        Restore-EnvFile
        Write-Status "Emergency restore of .env completed"
    }
    
    exit 1
} finally {
    # Cleanup any remaining backup files
    if (Test-Path ".env.backup") {
        Remove-Item ".env.backup" -Force -ErrorAction SilentlyContinue
    }
}