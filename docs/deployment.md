---
layout: default
title: Deployment Guide
nav_order: 8
nav_exclude: true
---

# Inventory App Deployment Guide

This legacy deployment note provides detailed Windows deployment information. Use [Deployment Guide](deployment/) for the current operational entry point.

## Overview

The deployment system consists of:

1. **PowerShell Module** (`InventoryApp.Deployment.psm1`) - Core deployment logic
2. **Deployment Script** (`Deploy-Application.ps1`) - Entry point with parameter handling
3. **GitHub Actions Workflow** (`release-deployment.yml`) - Automated release artifact creation
4. **Persistent Storage** - Symlink-based shared storage for logs, cache, sessions

## Architecture

### Directory Structure

```
C:\mwnf-server\github-apps\
├─ production/                          (symlink to active staging)
├─ staging-20251031-041516/             (current active deployment)
│  ├─ app/
│  ├─ routes/
│  ├─ resources/
│  ├─ public/
│  ├─ storage/                          (symlink to ../shared-storage/storage)
│  ├─ .env
│  └─ ...
├─ staging-20251030-123456/             (previous deployment - for rollback)
├─ staging-20251029-085743/             (older deployment - for rollback)
└─ shared-storage/
   └─ storage/                          (persistent across all deployments)
      ├─ app/
      ├─ logs/                          (preserved across deployments)
      ├─ framework/
      │  ├─ cache/                      (preserved across deployments)
      │  ├─ sessions/                   (preserved across deployments)
      │  └─ views/                      (preserved across deployments)
      └─ custom/                        (for custom storage needs)
```

### Key Benefits

- **Persistent Logs**: Application logs are preserved across deployments
- **Cached Data**: Configuration and route caches persist, reducing first-request latency
- **Session Preservation**: User sessions are not lost during deployment
- **Atomic Swaps**: Production symlink switch is atomic and reversible
- **Easy Rollback**: Previous deployments remain available for quick rollback

## Prerequisites

### System Requirements

- Windows Server 2016 or later
- PowerShell 5.0 or later
- Administrator privileges on the Windows machine
- 5GB free disk space (minimum)

### Software Requirements

- **PHP 8.2 or higher** - For running Laravel artisan commands
- **MySQL/MariaDB** - Database server with appropriate credentials
- **Web Server** - Apache, IIS, or compatible Windows web server

### PHP Installation Verification

Verify PHP is installed and version is 8.2+:

```powershell
C:\php\php.exe --version
# Output: PHP 8.2.x (cli) (built: ...)
```

## Pre-Deployment Setup

### 1. Generate Laravel APP_KEY

If deploying for the first time, generate the APP_KEY using a local Laravel installation:

```bash
php artisan key:generate --show
# Output: base64:xxxxx...
```

Save this key securely - you'll need it for deployment.

### 2. Prepare Database Credentials

Collect the following database information:

- Database hostname/IP (e.g., `127.0.0.1`)
- Database port (default: `3306`)
- Database name (e.g., `inventory_db`)
- Database username (e.g., `app`)
- Database user password

### 3. Verify Webserver Configuration

Ensure your webserver is configured to serve from the deployment path. Example for Apache:

```apache
<VirtualHost *:443>
    ServerName inventory.museumwnf.org
    DocumentRoot "C:\mwnf-server\github-apps\production\public"

    <Directory "C:\mwnf-server\github-apps\production">
        AllowOverride All
        Require all granted
    </Directory>
</VirtualHost>
```

### 4. Create Required Directories

Run these commands in PowerShell (as Administrator):

```powershell
New-Item -ItemType Directory -Path "C:\mwnf-server\github-apps" -Force
New-Item -ItemType Directory -Path "C:\mwnf-server\github-apps\shared-storage\storage" -Force
```

## Deployment Procedure

### Step 1: Download Release Artifact

1. Go to the [GitHub Releases](https://github.com/museumwithnofrontiers/inventory-app/releases) page
2. Find the version you want to deploy
3. Download the `inventory-app-release-*.zip` artifact
4. Extract it to a temporary directory:

```powershell
Expand-Archive -Path "C:\temp\inventory-app-release-*.zip" -DestinationPath "C:\temp\inventory-app-release"
```

### Step 2: Prepare Deployment Parameters

Create a PowerShell script to define your deployment parameters (e.g., `Deploy-Config.ps1`):

```powershell
# Deployment configuration
$deploymentParams = @{
    DeploymentPackagePath = "C:\temp\inventory-app-release"
    WebserverPath         = "C:\Apache24\htdocs\inventory-app"
    SharedStorageRoot     = "C:\mwnf-server\github-apps"
    PhpPath               = "C:\php\php.exe"
    AppUrl                = "https://inventory.museumwnf.org"
    AppName               = "Inventory App"
    AppEnv                = "production"
    AppKey                = "base64:xxxxx..."  # From step 1
    DatabaseHost          = "127.0.0.1"
    DatabasePort          = 3306
    DatabaseName          = "inventory_db"
    DatabaseUsername      = "app"
    Verbose               = $true
}

# Convert database password to SecureString
$dbPassword = ConvertTo-SecureString "your-secure-password" -AsPlainText -Force
$deploymentParams.DatabasePassword = $dbPassword

# Execute deployment
& "C:\path\to\repository\scripts\Deploy-Application.ps1" @deploymentParams
```

### Step 3: Execute Deployment

Run the deployment script:

```powershell
cd "C:\path\to\repository"
.\scripts\Deploy-Application.ps1 `
    -DeploymentPackagePath "C:\temp\inventory-app-release" `
    -WebserverPath "C:\Apache24\htdocs\inventory-app" `
    -SharedStorageRoot "C:\mwnf-server\github-apps" `
    -PhpPath "C:\php\php.exe" `
    -AppUrl "https://inventory.museumwnf.org" `
    -AppName "Inventory App" `
    -AppEnv "production" `
    -AppKey "base64:xxxxx..." `
    -DatabaseHost "127.0.0.1" `
    -DatabasePort 3306 `
    -DatabaseName "inventory_db" `
    -DatabaseUsername "app" `
    -DatabasePassword (ConvertTo-SecureString "password" -AsPlainText -Force) `
    -Verbose
```

## Deployment Phases

The script executes in 8 phases with clear status reporting:

### Phase 1: Validation

- Verifies PHP 8.2+ installation
- Checks Laravel application structure
- Validates disk space availability
- Confirms write permissions

### Phase 2: Staging Preparation

- Creates timestamped staging directory (`staging-YYYYMMDD-HHMMSS`)
- Copies deployment package to staging
- Validates package integrity

### Phase 3: Persistent Storage Configuration

- Ensures shared storage directory exists
- Creates required subdirectories (app, logs, framework/cache, framework/sessions, framework/views)
- Creates symlink from staging to shared storage

### Phase 4: Application Transition

- Executes `php artisan down` to enter maintenance mode
- Prevents user access during deployment

### Phase 5: Production Swap

- Backs up current production symlink as `production_swap` (for rollback)
- Creates new production symlink pointing to new staging directory
- Atomic operation with rollback capability

### Phase 6: Configuration

- Copies `.env.example` to `.env`
- Replaces environment variables with provided values
- Validates all critical variables are set
- Sets secure file permissions

### Phase 7: Application Initialization

- Runs database migrations (`php artisan migrate --force`)
- Syncs permissions (`php artisan permissions:sync --production`)
- Caches configuration (`php artisan config:cache`)
- Caches routes (`php artisan route:cache`)
- Caches views (`php artisan view:cache`)
- Brings application online (`php artisan up`)

### Phase 8: Cleanup

- Removes old staging directories (keeps last 3)
- Removes production swap backup

## Post-Deployment Verification

### 1. Check Application Status

```powershell
# Verify production symlink points to new staging
Get-Item -Path "C:\Apache24\htdocs\inventory-app" | Select-Object LinkType, Target
```

Expected output:

```
LinkType Target
-------- ------
Junction C:\mwnf-server\github-apps\staging-YYYYMMDD-HHMMSS
```

### 2. Verify Persistent Storage

```powershell
# Confirm storage symlink is created
Get-Item -Path "C:\Apache24\htdocs\inventory-app\storage" | Select-Object LinkType, Target

# Check logs are being written
Get-ChildItem -Path "C:\mwnf-server\github-apps\shared-storage\storage\logs"
```

### 3. Test Application Health

```bash
# Test API endpoint
curl -X GET "https://inventory.museumwnf.org/api/health"

# Should return 200 OK
```

### 4. Review Logs

```powershell
# Check Laravel logs
Get-ChildItem -Path "C:\mwnf-server\github-apps\shared-storage\storage\logs\*" -Include "*.log" |
    Sort-Object -Property LastWriteTime -Descending |
    Select-Object -First 1 |
    Get-Content -Tail 20
```

## Rollback Procedure

If deployment issues are discovered, perform an immediate rollback:

### Automatic Rollback (During Deployment)

If any error occurs during deployment after the production swap, the script automatically:

1. Detects the error
2. Restores `production_swap` as the active `production` symlink
3. Rolls back to the previous deployment
4. Reports the rollback action

### Manual Rollback (Post-Deployment)

If you need to manually rollback after deployment:

```powershell
# List available staging directories (newest first)
Get-ChildItem -Path "C:\mwnf-server\github-apps" -Directory -Filter "staging-*" |
    Sort-Object -Property Name -Descending |
    Select-Object -First 3

# Swap production to previous version
Remove-Item -Path "C:\Apache24\htdocs\inventory-app" -Force -ErrorAction SilentlyContinue
New-Item -ItemType Junction `
    -Path "C:\Apache24\htdocs\inventory-app" `
    -Target "C:\mwnf-server\github-apps\staging-PREVIOUS-VERSION"

# Verify the swap
Get-Item -Path "C:\Apache24\htdocs\inventory-app" | Select-Object LinkType, Target
```

## Troubleshooting

### PHP Version Error

**Error**: "PHP version must be 8.2 or higher"

**Solution**:

```powershell
# Update PHP_PATH in deployment parameters
C:\php\php.exe --version  # Check current version
# Install PHP 8.2 from https://windows.php.net/
```

### Database Connection Failed

**Error**: "SQLSTATE[HY000]: General error: 2006 MySQL server has gone away"

**Solution**:

```powershell
# Verify database credentials
mysql -h 127.0.0.1 -u app -p inventory_db -e "SELECT 1;"

# Check database server is running
Get-Service | Where-Object {$_.Name -like "*MySQL*" -or $_.Name -like "*MariaDB*"}
```

### Storage Symlink Failed

**Error**: "Failed to create storage symlink"

**Solution**:

```powershell
# Verify shared storage exists
Test-Path "C:\mwnf-server\github-apps\shared-storage"

# Check permissions on parent directory
Get-Acl "C:\mwnf-server\github-apps" | Select-Object -ExpandProperty Access

# Ensure running as Administrator
# Check: [Security.Principal.WindowsIdentity]::GetCurrent().Owner
```

### Insufficient Disk Space

**Error**: "Insufficient disk space. Required: 5GB"

**Solution**:

```powershell
# Check available disk space
Get-Volume -DriveLetter C | Select-Object SizeRemaining

# Remove old staging directories manually if needed
Get-ChildItem -Path "C:\mwnf-server\github-apps" -Directory -Filter "staging-*" |
    Sort-Object -Property Name -Descending |
    Select-Object -Skip 3 |
    Remove-Item -Recurse -Force
```

### Permissions Sync Command Not Found

**Error**: "permissions:sync command not found"

**Solution**: This is not critical - the script will skip this step. Ensure you have the latest `inventory-app` release with the permissions command implemented.

## Environment Variables

The deployment script generates the following environment variables in `.env`:

| Variable         | Source              | Example                         |
| ---------------- | ------------------- | ------------------------------- |
| APP_NAME         | $AppName            | Inventory App                   |
| APP_ENV          | $AppEnv             | production                      |
| APP_DEBUG        | auto-set            | false (for production)          |
| APP_URL          | $AppUrl             | https://inventory.museumwnf.org |
| APP_KEY          | $AppKey             | base64:xxxxx...                 |
| DB_CONNECTION    | hardcoded           | mysql                           |
| DB_HOST          | $DatabaseHost       | 127.0.0.1                       |
| DB_PORT          | $DatabasePort       | 3306                            |
| DB_DATABASE      | $DatabaseName       | inventory_db                    |
| DB_USERNAME      | $DatabaseUsername   | app                             |
| DB_PASSWORD      | $DatabaseCredential | (from PSCredential)             |
| DB_SSLMODE       | $DatabaseSslMode    | prefer                          |
| LOG_CHANNEL      | auto-set            | stack (for production)          |
| CACHE_DRIVER     | hardcoded           | file                            |
| SESSION_DRIVER   | hardcoded           | file                            |
| QUEUE_CONNECTION | hardcoded           | sync                            |

## Advanced Configuration

### Custom Staging Retention

By default, the script keeps 3 previous staging directories for rollback. To change this:

```powershell
.\scripts\Deploy-Application.ps1 `
    -DeploymentPackagePath "..." `
    # ... other parameters ...
    -KeepStagingCount 5  # Keep 5 staging directories
```

### Database SSL Configuration

Configure database SSL mode based on your MySQL server:

```powershell
# For development (no SSL validation)
-DatabaseSslMode "skip-verify"

# For production (prefer SSL, fall back to unencrypted)
-DatabaseSslMode "prefer"

# For production (require SSL)
-DatabaseSslMode "require"
```

### GitHub Token for npm Authentication

If using private npm packages:

```powershell
$deploymentParams.GitHubToken = "ghp_xxxxx..."
```

## Exit Codes

The deployment script returns the following exit codes:

| Code | Meaning                                               |
| ---- | ----------------------------------------------------- |
| 0    | Successful deployment                                 |
| 1    | Deployment error (check logs)                         |
| 2    | Prerequisites failed (missing PHP, permissions, etc.) |

## See Also

- [Installation Script Design](/deployment/#) - Architecture documentation
- [README](/README) - Project overview
- [GitHub Releases](https://github.com/museumwithnofrontiers/inventory-app/releases) - Download releases
