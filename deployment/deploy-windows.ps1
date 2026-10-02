# Deployment Script for Windows Server
# 
# This PowerShell script provides a template for deploying the Inventory Management
# Laravel application on Windows Server with Apache.
#
# Instructions:
# 1. Review and customize the variables below
# 2. Run this script as Administrator
# 3. Test the deployment

param(
    [string]$AppPath = "C:\inetpub\wwwroot\inventory-app",
    [string]$Domain = "inventory-app.local",
    [switch]$SkipBuild = $false,
    [switch]$SkipComposer = $false
)

# Configuration
$ErrorActionPreference = "Stop"
$ApacheConfigPath = "C:\Apache24\conf\extra\httpd-vhosts.conf"
$PHPPath = "C:\php"
$ComposerPath = "C:\ProgramData\ComposerSetup\bin\composer.bat"

Write-Host "Starting deployment of Inventory Management App..." -ForegroundColor Green

# Function to check if running as administrator
function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

# Check administrator privileges
if (-not (Test-Administrator)) {
    Write-Error "This script must be run as Administrator"
    exit 1
}

# Verify prerequisites
Write-Host "Checking prerequisites..." -ForegroundColor Yellow

# Check PHP
if (-not (Test-Path "$PHPPath\php.exe")) {
    Write-Error "PHP not found at $PHPPath. Please install PHP 8.2 or higher."
    exit 1
}

$phpVersion = & "$PHPPath\php.exe" -r "echo PHP_VERSION;"
Write-Host "Found PHP version: $phpVersion" -ForegroundColor Green

# Check Composer
if (-not (Test-Path $ComposerPath) -and -not $SkipComposer) {
    Write-Error "Composer not found at $ComposerPath. Please install Composer."
    exit 1
}

# Check Node.js (for building frontend assets)
if (-not $SkipBuild) {
    try {
        $nodeVersion = node --version
        Write-Host "Found Node.js version: $nodeVersion" -ForegroundColor Green
    } catch {
        Write-Error "Node.js not found. Please install Node.js (LTS version) or higher."
        exit 1
    }
}

# Create application directory
Write-Host "Creating application directory..." -ForegroundColor Yellow
if (-not (Test-Path $AppPath)) {
    New-Item -ItemType Directory -Path $AppPath -Force
    Write-Host "Created directory: $AppPath" -ForegroundColor Green
}

# Set directory permissions
Write-Host "Setting directory permissions..." -ForegroundColor Yellow
$acl = Get-Acl $AppPath
$accessRule = New-Object System.Security.AccessControl.FileSystemAccessRule("IIS_IUSRS", "FullControl", "ContainerInherit,ObjectInherit", "None", "Allow")
$acl.SetAccessRule($accessRule)
Set-Acl -Path $AppPath -AclObject $acl

# Install Composer dependencies
if (-not $SkipComposer) {
    Write-Host "Installing Composer dependencies..." -ForegroundColor Yellow
    Set-Location $AppPath
    & $ComposerPath install --optimize-autoloader --no-dev
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Composer install failed"
        exit 1
    }
}

# Build frontend assets
if (-not $SkipBuild) {
    Write-Host "Installing Node.js dependencies..." -ForegroundColor Yellow
    Set-Location $AppPath
    npm ci --only=production
    if ($LASTEXITCODE -ne 0) {
        Write-Error "npm install failed"
        exit 1
    }

    Write-Host "Building frontend assets..." -ForegroundColor Yellow
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Frontend build failed"
        exit 1
    }
}

# Configure Laravel
Write-Host "Configuring Laravel..." -ForegroundColor Yellow
Set-Location $AppPath

# Generate application key if needed
if (-not (Test-Path ".env")) {
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Host "Copied .env.example to .env" -ForegroundColor Green
    }
    
    php artisan key:generate --force
    Write-Host "Generated application key" -ForegroundColor Green
}

# Set storage permissions
$storagePath = Join-Path $AppPath "storage"
if (Test-Path $storagePath) {
    $acl = Get-Acl $storagePath
    $accessRule = New-Object System.Security.AccessControl.FileSystemAccessRule("IIS_IUSRS", "FullControl", "ContainerInherit,ObjectInherit", "None", "Allow")
    $acl.SetAccessRule($accessRule)
    Set-Acl -Path $storagePath -AclObject $acl
    Write-Host "Set storage directory permissions" -ForegroundColor Green
}

# Set bootstrap/cache permissions
$cachePath = Join-Path $AppPath "bootstrap\cache"
if (Test-Path $cachePath) {
    $acl = Get-Acl $cachePath
    $accessRule = New-Object System.Security.AccessControl.FileSystemAccessRule("IIS_IUSRS", "FullControl", "ContainerInherit,ObjectInherit", "None", "Allow")
    $acl.SetAccessRule($accessRule)
    Set-Acl -Path $cachePath -AclObject $acl
    Write-Host "Set cache directory permissions" -ForegroundColor Green
}

# Optimize Laravel
Write-Host "Optimizing Laravel..." -ForegroundColor Yellow
php artisan config:cache
php artisan route:cache
php artisan view:cache
Write-Host "Laravel optimization complete" -ForegroundColor Green

# Configure Apache Virtual Host
Write-Host "Configuring Apache Virtual Host..." -ForegroundColor Yellow

$vhostConfig = @"

# Inventory Management App Virtual Host
<VirtualHost *:80>
    ServerName $Domain
    DocumentRoot "$AppPath\public"
    
    <Directory "$AppPath\public">
        AllowOverride All
        Require all granted
        Options -Indexes +FollowSymLinks
        
        RewriteEngine On
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteRule ^(.*)$ index.php [QSA,L]
    </Directory>
    
    ErrorLog "C:\Apache24\logs\inventory-app-error.log"
    CustomLog "C:\Apache24\logs\inventory-app-access.log" combined
    
    <FilesMatch \.php$>
        SetHandler application/x-httpd-php
    </FilesMatch>
</VirtualHost>
"@

# Backup existing Apache config
if (Test-Path $ApacheConfigPath) {
    $backupPath = "$ApacheConfigPath.backup.$(Get-Date -Format 'yyyyMMdd-HHmmss')"
    Copy-Item $ApacheConfigPath $backupPath
    Write-Host "Backed up Apache config to: $backupPath" -ForegroundColor Green
}

# Add virtual host to Apache config
Add-Content -Path $ApacheConfigPath -Value $vhostConfig
Write-Host "Added virtual host configuration" -ForegroundColor Green

# Add hosts file entry (optional)
$hostsPath = "$env:SystemRoot\System32\drivers\etc\hosts"
$hostsEntry = "127.0.0.1 $Domain"

$hostsContent = Get-Content $hostsPath -ErrorAction SilentlyContinue
if ($hostsContent -notcontains $hostsEntry) {
    Write-Host "Adding entry to hosts file..." -ForegroundColor Yellow
    Add-Content -Path $hostsPath -Value $hostsEntry
    Write-Host "Added $hostsEntry to hosts file" -ForegroundColor Green
}

# Restart Apache service
Write-Host "Restarting Apache service..." -ForegroundColor Yellow
try {
    Restart-Service -Name "Apache2.4" -Force
    Write-Host "Apache service restarted successfully" -ForegroundColor Green
} catch {
    Write-Warning "Could not restart Apache service automatically. Please restart manually."
}

# Smoke check: the admin panel is the application. `/` redirects to /admin,
# and the panel's login page answers. Only warns: this script doesn't run the
# migrations, and the login page needs the sessions table they create.
function Get-HttpAnswer([string]$Url) {
    $request = [System.Net.HttpWebRequest]::Create($Url)
    $request.AllowAutoRedirect = $false
    try {
        $response = $request.GetResponse()
    } catch [System.Net.WebException] {
        $response = $_.Exception.Response
    }
    if (-not $response) {
        return @{ Status = 0; Location = '' }
    }
    $answer = @{ Status = [int]$response.StatusCode; Location = [string]$response.Headers['Location'] }
    $response.Close()
    return $answer
}

Write-Host "Running smoke check..." -ForegroundColor Yellow
$root = Get-HttpAnswer "http://$Domain/"
$login = Get-HttpAnswer "http://$Domain/admin/login"
if ($root.Status -eq 302 -and $root.Location -match '/admin$') {
    Write-Host "/ redirects to /admin" -ForegroundColor Green
} else {
    Write-Warning "/ answered $($root.Status) $($root.Location) (expected a 302 to /admin)"
}
if ($login.Status -eq 200) {
    Write-Host "/admin/login answers 200" -ForegroundColor Green
} else {
    Write-Warning "/admin/login answered $($login.Status) (expected 200 once the migrations have run)"
}

Write-Host ""
Write-Host "Deployment completed successfully!" -ForegroundColor Green
Write-Host "Application URL: http://$Domain" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Configure your database settings in .env"
Write-Host "2. Run database migrations: php artisan migrate"
Write-Host "3. Seed initial data: php artisan db:seed"
Write-Host "4. Test the application in your browser"
Write-Host "5. Configure SSL certificate for production"
Write-Host ""
Write-Host "For SSL configuration, refer to deployment/README.md" -ForegroundColor Cyan
