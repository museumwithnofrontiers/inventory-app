---
layout: default
title: Production Deployment
parent: Deployment Guide
nav_order: 1
---

# Production Deployment

{: .no_toc }

Complete guide for deploying the Inventory Management API to a production Windows Server environment.

## Table of Contents

{: .no_toc .text-delta }

1. TOC
   {:toc}

---

## Prerequisites

### System Requirements

| Component   | Minimum             | Recommended         |
| ----------- | ------------------- | ------------------- |
| **OS**      | Windows Server 2019 | Windows Server 2022 |
| **RAM**     | 4 GB                | 8 GB+               |
| **Storage** | 20 GB               | 50 GB+ SSD          |
| **CPU**     | 2 cores             | 4 cores+            |

### Software Requirements

- **PHP 8.2+** with required extensions
- **Apache HTTP 2.4+** or **Nginx 1.18+**
- **MariaDB 10.5+** or **MySQL 8.0+**
- **Node.js 18+** (for asset compilation)
- **Composer 2.0+**
- **Git** (for deployment)

## Step 1: Server Preparation

### 1.1 Install PHP

```powershell
# Download PHP 8.2+ for Windows
# Extract to C:\php
# Add C:\php to PATH environment variable

# Required PHP extensions:
# - fileinfo
# - zip
# - sqlite3
# - pdo_sqlite
# - pdo_mysql
# - gd
# - exif
# - openssl
# - curl
# - mbstring
```

### 1.2 Install Composer

```powershell
# Download and install Composer from https://getcomposer.org/
# Verify installation
composer --version
```

### 1.3 Install Node.js

```powershell
# Download Node.js 18+ LTS from https://nodejs.org/
# Verify installation
node --version
npm --version
```

### 1.4 Install Database

```powershell
# Install MariaDB 10.5+ or MySQL 8.0+
# Create database and user
CREATE DATABASE inventory_production;
CREATE USER 'inventory_user'@'localhost' IDENTIFIED BY 'secure_password';
GRANT ALL PRIVILEGES ON inventory_production.* TO 'inventory_user'@'localhost';
FLUSH PRIVILEGES;
```

## Step 2: Application Deployment

### 2.1 Download Application

```powershell
# Clone repository to production directory
cd C:\inetpub\wwwroot\
git clone https://github.com/museumwithnofrontiers/inventory-app.git
cd inventory-app

# Or download release package
# Extract to C:\inetpub\wwwroot\inventory-app
```

### 2.2 Install Dependencies

```powershell
# Install PHP dependencies
composer install --optimize-autoloader --no-dev

# Install Node.js dependencies
npm ci --only=production

# Build frontend assets
npm run build
```

### 2.3 Environment Configuration

```powershell
# Copy environment file
cp .env.example .env

# Generate application key
php artisan key:generate
```

Edit `.env` file with production settings:

```env
# Application
APP_NAME="Inventory Management"
APP_ENV=production
APP_KEY=base64:YOUR_GENERATED_KEY
APP_DEBUG=false
APP_TIMEZONE=UTC
APP_URL=https://your-domain.com

# Database
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=inventory_production
DB_USERNAME=inventory_user
DB_PASSWORD=secure_password

# Image Storage
UPLOAD_IMAGES_DISK=local_upload_images
UPLOAD_IMAGES_PATH=uploads/images
AVAILABLE_IMAGES_DISK=local_available_images
AVAILABLE_IMAGES_PATH=available/images
PICTURES_DISK=local_pictures
PICTURES_PATH=pictures

# Cache
CACHE_STORE=file
SESSION_DRIVER=file
QUEUE_CONNECTION=database

# Mail (configure as needed)
MAIL_MAILER=smtp
MAIL_HOST=your-smtp-host
MAIL_PORT=587
MAIL_USERNAME=your-email
MAIL_PASSWORD=your-password
MAIL_ENCRYPTION=tls

# Security
# IMPORTANT: SANCTUM_STATEFUL_DOMAINS must include all domains that will access the API
# For example: inventory.museumwnf.org (without protocol, without trailing slash)
# Multiple domains: inventory.museumwnf.org,app.museumwnf.org
SANCTUM_STATEFUL_DOMAINS=your-frontend-domain.com

# SESSION_DOMAIN: Set to .yourdomain.com (with leading dot) for subdomain cookie sharing
# Leave as null if you don't need subdomain support
# SESSION_DOMAIN=.museumwnf.org
SESSION_DOMAIN=null

SESSION_SECURE_COOKIE=true
SESSION_SAME_SITE=strict

# Logging
LOG_CHANNEL=daily
LOG_LEVEL=error
```

### 2.4 Database Setup

```powershell
# Run database migrations
php artisan migrate --force

# Seed initial data
php artisan db:seed --force

# Create admin user (optional)
php artisan make:user-admin
```

### 2.5 Optimize Application

```powershell
# Cache configuration
php artisan config:cache

# Cache routes
php artisan route:cache

# Cache views
php artisan view:cache

# Create symbolic link for storage
php artisan storage:link
```

## Step 3: Web Server Configuration

### 3.1 Apache Configuration

Use the provided configuration files:

```powershell
# Copy Apache configuration
cp deployment\apache-windows.conf C:\Apache24\conf\extra\httpd-inventory.conf

# Include in main Apache config
# Add to httpd.conf:
Include conf/extra/httpd-inventory.conf
```

Update `deployment\apache-windows.conf`:

```apache
<VirtualHost *:80>
    ServerName your-domain.com
    DocumentRoot "C:/inetpub/wwwroot/inventory-app/public"

    <Directory "C:/inetpub/wwwroot/inventory-app/public">
        AllowOverride All
        Require all granted
        Options -Indexes +FollowSymLinks

        RewriteEngine On
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteRule ^(.*)$ index.php [QSA,L]
    </Directory>

    ErrorLog "C:/Apache24/logs/inventory-app-error.log"
    CustomLog "C:/Apache24/logs/inventory-app-access.log" combined
</VirtualHost>
```

### 3.2 SSL Configuration

```apache
<VirtualHost *:443>
    ServerName your-domain.com
    DocumentRoot "C:/inetpub/wwwroot/inventory-app/public"

    SSLEngine on
    SSLCertificateFile "C:/Apache24/conf/ssl/certificate.crt"
    SSLCertificateKeyFile "C:/Apache24/conf/ssl/private.key"

    # ... rest of configuration
</VirtualHost>
```

## Step 4: Security Hardening

### 4.1 File Permissions

```powershell
# Set proper permissions
icacls "C:\inetpub\wwwroot\inventory-app" /grant "IIS_IUSRS:F" /T
icacls "C:\inetpub\wwwroot\inventory-app\storage" /grant "IIS_IUSRS:F" /T
icacls "C:\inetpub\wwwroot\inventory-app\bootstrap\cache" /grant "IIS_IUSRS:F" /T

# Restrict access to sensitive files
icacls "C:\inetpub\wwwroot\inventory-app\.env" /deny "Everyone:R"
```

### 4.2 Firewall Configuration

```powershell
# Allow HTTP and HTTPS
netsh advfirewall firewall add rule name="HTTP" dir=in action=allow protocol=TCP localport=80
netsh advfirewall firewall add rule name="HTTPS" dir=in action=allow protocol=TCP localport=443
```

### 4.3 SSL Certificate

```powershell
# Install SSL certificate from trusted CA
# Configure automatic renewal if using Let's Encrypt
# Update Apache configuration with certificate paths
```

### 4.4 Image Storage Permissions (Linux)

On the Linux server (`scripts/provision.sh`), two users share the image disks:

- `deploy` runs the command-line tools: the deploy itself, `images:backfill-originals`, the legacy image sync and the import-tool `ship`.
- `www-data` runs PHP-FPM and the queue: uploads and `/pub`.

| Directory (under `/opt/inventory/shared/storage/app`) | Owner | Mode | Why |
|---|---|---|---|
| `private/image-originals/` and `images/` | `deploy:www-data` | `2770` | The pristine originals. Group read/write, nothing for others, and setgid keeps new files in `www-data`. |
| `public/pictures/` | `deploy:www-data` | `2775` | The burned renditions `www-data` writes and `/pub` serves. |

The app chmods every original it writes to `0660`. It can't fix a directory that the process umask narrowed when creating it, which is why the directories are created up front.

`provision.sh` creates them on a new server. On a server provisioned before M9, apply them once as `deploy`, who owns the tree, so no `sudo` is needed:

```bash
cd /opt/inventory/shared/storage/app
mkdir -p private/image-originals/images public/pictures
chgrp -R www-data private/image-originals public/pictures
find private/image-originals -type d -exec chmod 2770 {} +
find private/image-originals -type f -exec chmod 0660 {} +
chmod 2775 public/pictures
```

If a `find` line reports `Operation not permitted`, the file was created by `www-data`, and only its owner or root can change its mode. Run that line as root.

## Step 5: Automated Deployment

### 5.1 Using Deployment Script

```powershell
# Run automated deployment script
.\deployment\deploy-windows.ps1 -Domain "your-domain.com" -AppPath "C:\inetpub\wwwroot\inventory-app"
```

### 5.2 Manual Deployment Steps

```powershell
# 1. Download/update application code
git pull origin main

# 2. Update dependencies
composer install --optimize-autoloader --no-dev
npm ci --only=production
npm run build

# 3. Update database
php artisan migrate --force

# 4. Clear caches
php artisan config:cache
php artisan route:cache
php artisan view:cache

# 5. Restart web server
Restart-Service -Name "Apache2.4"
```

## Step 6: Monitoring and Maintenance

### 6.1 Log Files

Monitor these log files:

- **Application logs**: `storage/logs/laravel.log`
- **Web server logs**: `C:/Apache24/logs/inventory-app-*.log`
- **PHP error logs**: `C:/php/logs/php_errors.log`

### 6.2 Health Checks

```powershell
# Check application status
curl https://your-domain.com/api/health

# Check database connectivity
php artisan tinker
>>> DB::connection()->getPdo();
```

### 6.3 Backup Strategy

```powershell
# Database backup
mysqldump -u inventory_user -p inventory_production > backup_$(Get-Date -Format "yyyyMMdd_HHmmss").sql

# File backup
robocopy "C:\inetpub\wwwroot\inventory-app" "C:\Backups\inventory-app" /MIR /XD "vendor" "node_modules" ".git"
```

## Step 7: Performance Optimization

### 7.1 PHP Optimization

```ini
; php.ini optimizations
memory_limit = 256M
max_execution_time = 300
max_input_vars = 3000
upload_max_filesize = 64M
post_max_size = 64M

; OPcache
opcache.enable=1
opcache.memory_consumption=256
opcache.max_accelerated_files=20000
opcache.validate_timestamps=0
```

### 7.2 Database Optimization

```sql
-- Create indexes for performance
CREATE INDEX idx_projects_created_at ON projects(created_at);
CREATE INDEX idx_contexts_project_id ON contexts(project_id);
CREATE INDEX idx_languages_internal_name ON languages(internal_name);
```

### 7.3 Web Server Optimization

```apache
# Enable compression
LoadModule deflate_module modules/mod_deflate.so
<Location />
    SetOutputFilter DEFLATE
</Location>

# Enable caching
LoadModule expires_module modules/mod_expires.so
<LocationMatch "\.(css|js|png|jpg|jpeg|gif|ico|svg)$">
    ExpiresActive On
    ExpiresDefault "access plus 1 year"
</LocationMatch>
```

## Troubleshooting

### Common Issues

1. **419 CSRF Token Mismatch / Session Errors**

   **Symptoms**: Users get 419 errors after logging in or when making requests

   **Solution**:

   ```bash
   # In your production .env file:

   # Add your production domain (without https://, without trailing slash)
   SANCTUM_STATEFUL_DOMAINS=inventory.museumwnf.org

   # For subdomain support (e.g., api.domain.com + app.domain.com):
   SESSION_DOMAIN=.museumwnf.org  # Note the leading dot

   # For single domain deployments:
   SESSION_DOMAIN=null

   # Ensure these are also set:
   SESSION_SECURE_COOKIE=true
   SESSION_SAME_SITE=lax
   ```

   After changing `.env`:

   ```powershell
   php artisan config:clear
   php artisan cache:clear
   ```

2. **500 Internal Server Error**
   - Check PHP error logs
   - Verify file permissions
   - Ensure `.env` file is properly configured

3. **Database Connection Failed**
   - Verify database credentials
   - Check database server status
   - Confirm firewall settings

4. **Static Assets Not Loading**
   - Verify `npm run build` was executed
   - Check file permissions on `public/build/`
   - Confirm web server static file handling

5. **SSL Certificate Issues**
   - Verify certificate installation
   - Check certificate expiration
   - Confirm intermediate certificates

### Performance Issues

1. **Slow Response Times**
   - Enable PHP OPcache
   - Optimize database queries
   - Enable web server compression

2. **High Memory Usage**
   - Increase PHP memory limit
   - Optimize Laravel caching
   - Monitor for memory leaks

---

## Next Steps

- [Configuration Guide](configuration) - Detailed configuration options
- 🏃 [Development Setup](development-setup) - Local development environment
- [Monitoring](monitoring) - Application monitoring and alerting
