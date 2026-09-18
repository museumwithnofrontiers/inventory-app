---
layout: default
title: Testing & Troubleshooting
parent: Deployment Guide
nav_order: 7
---

# Testing & Troubleshooting Guide

{: .no_toc }

Comprehensive guide for testing the application and troubleshooting common issues in development and production environments.

## Table of Contents

{: .no_toc .text-delta }

1. TOC
   {:toc}

---

## Testing the Application

### Development Environment Testing

#### Quick Health Check

```bash
# Start development environment
composer dev

# Test API health endpoint
curl http://localhost:8000/api/health

# Test frontend
curl http://localhost:8000

# Test Vite development server
curl http://localhost:5173/@vite/client
```

#### Database Testing

```bash
# Check database connection
php artisan tinker
>>> DB::connection()->getPdo();

# Test migrations
php artisan migrate:status

# Test seeding
php artisan db:seed --class=CountrySeeder
```

#### Frontend Testing

```bash
# Test Vue.js compilation
npm run build

# Run frontend unit tests
npm run test

# Run integration tests
npm run test:integration

# Check TypeScript compilation
npm run type-check
```

### Production Environment Testing

#### Server Configuration Test

```bash
# Test Apache configuration
apache2ctl configtest

# Test Nginx configuration
nginx -t

# Test PHP-FPM
systemctl status php8.5-fpm
```

#### Application Testing

```bash
# Test database connectivity
php artisan tinker --execute="DB::connection()->getPdo();"

# Test storage permissions
php artisan storage:link

# Test cache functionality
php artisan cache:clear
php artisan config:cache

# Test queue functionality
php artisan queue:work --once
```

#### Performance Testing

```bash
# Test response times
curl -w "@curl-format.txt" -o /dev/null -s http://your-domain.com/api/projects

# Create curl-format.txt:
echo "     time_namelookup:  %{time_namelookup}\n
        time_connect:  %{time_connect}\n
     time_appconnect:  %{time_appconnect}\n
    time_pretransfer:  %{time_pretransfer}\n
       time_redirect:  %{time_redirect}\n
  time_starttransfer:  %{time_starttransfer}\n
                     ----------\n
          time_total:  %{time_total}\n" > curl-format.txt
```

#### Security Testing

```bash
# Test SSL configuration
curl -I https://your-domain.com

# Test security headers
curl -I https://your-domain.com | grep -E "(X-Content-Type-Options|X-Frame-Options|Strict-Transport-Security)"

# Test API authentication
curl -X GET http://localhost:8000/api/projects \
     -H "Accept: application/json" \
     -H "Authorization: Bearer invalid_token"
```

## Troubleshooting Common Issues

### Development Environment Issues

#### Port Already in Use

**Problem**: `Address already in use` error when starting development servers.

**Solution**:

```powershell
# Check what's using the port
netstat -ano | findstr :8000

# Kill the process (replace PID with actual process ID)
taskkill /PID 1234 /F
```

#### Database Connection Failed

**Problem**: `SQLSTATE[HY000] [2002] Connection refused`

**Solution**:

```bash
# For SQLite (development)
# Check if database file exists
touch database/database.sqlite

# Check .env configuration
DB_CONNECTION=sqlite
DB_DATABASE=database/database.sqlite

# For MySQL/MariaDB
# Check service status
systemctl status mysql

# Test connection manually
mysql -u your_user -p -h localhost your_database
```

#### NPM/Node.js Issues

**Problem**: `Module not found` or `Cannot resolve dependency` errors.

**Solution**:

```bash
# Clear npm cache
npm cache clean --force

# Delete node_modules and package-lock.json
rm -rf node_modules package-lock.json

# Reinstall dependencies
npm install

# For Windows PowerShell:
Remove-Item -Recurse -Force node_modules, package-lock.json
npm install
```

#### Vite Build Errors

**Problem**: `Build failed` or `TypeScript errors` during build.

**Solution**:

```bash
# Check TypeScript configuration
npm run type-check

# Clear Vite cache
rm -rf node_modules/.vite

# For Windows:
Remove-Item -Recurse -Force node_modules\.vite

# Update dependencies
npm update

# Build with detailed output
npm run build -- --mode development
```

#### PHP Artisan Errors

**Problem**: `Class not found` or `ReflectionException` errors.

**Solution**:

```bash
# Clear all Laravel caches
php artisan optimize:clear

# Regenerate autoload files
composer dump-autoload

# Clear specific caches
php artisan config:clear
php artisan route:clear
php artisan view:clear
php artisan cache:clear
```

### Production Environment Issues

#### 500 Internal Server Error

**Problem**: Generic server error in production.

**Investigation**:

```bash
# Check Laravel logs
tail -f storage/logs/laravel.log

# Check web server error logs
# Apache:
tail -f /var/log/apache2/error.log

# Nginx:
tail -f /var/log/nginx/error.log

# Check PHP-FPM logs
tail -f /var/log/php8.5-fpm.log
```

**Common Solutions**:

```bash
# Fix file permissions
chown -R www-data:www-data storage bootstrap/cache
chmod -R 775 storage bootstrap/cache

# Check .env file exists and is readable
ls -la .env

# Ensure application key is set
php artisan key:generate

# Clear and rebuild caches
php artisan optimize:clear
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

#### 502 Bad Gateway (Nginx)

**Problem**: Nginx cannot connect to PHP-FPM.

**Investigation**:

```bash
# Check PHP-FPM status
systemctl status php8.5-fpm

# Check socket permissions
ls -la /var/run/php/

# Check Nginx configuration
nginx -t
```

**Solutions**:

```bash
# Restart PHP-FPM
systemctl restart php8.5-fpm

# Check socket path in Nginx config matches PHP-FPM
# Nginx: fastcgi_pass unix:/var/run/php/php8.5-fpm.sock;
# PHP-FPM: listen = /var/run/php/php8.5-fpm.sock

# Fix socket permissions
chown www-data:www-data /var/run/php/php8.5-fpm.sock
```

#### Database Connection Issues

**Problem**: `Connection refused` or `Access denied` in production.

**Investigation**:

```bash
# Test database connection
mysql -u your_user -p -h your_host your_database

# Check database service
systemctl status mysql

# Check network connectivity
telnet your_db_host 3306
```

**Solutions**:

```bash
# Check database credentials in .env
DB_HOST=correct_host
DB_DATABASE=correct_database
DB_USERNAME=correct_user
DB_PASSWORD=correct_password

# Grant database permissions
GRANT ALL PRIVILEGES ON your_database.* TO 'your_user'@'%';
FLUSH PRIVILEGES;

# Check firewall rules
ufw status
```

#### Static Assets Not Loading

**Problem**: CSS/JS files return 404 errors.

**Investigation**:

```bash
# Check if build files exist
ls -la public/build/

# Check web server configuration
# Verify static file handling is configured
```

**Solutions**:

```bash
# Rebuild frontend assets
npm run build

# Check Vite configuration
# Ensure build outputs to public/build/

# Verify web server static file configuration
# Apache: Check mod_rewrite and .htaccess
# Nginx: Check location blocks for static files

# Clear browser cache
# Force refresh: Ctrl+F5
```

#### SSL Certificate Issues

**Problem**: `SSL certificate verify failed` or `ERR_CERT_AUTHORITY_INVALID`.

**Investigation**:

```bash
# Check certificate validity
openssl x509 -in /path/to/certificate.crt -text -noout

# Test SSL configuration
curl -I https://your-domain.com

# Check certificate chain
openssl s_client -connect your-domain.com:443 -showcerts
```

**Solutions**:

```bash
# Renew certificate (Let's Encrypt)
certbot renew

# Install intermediate certificates
# Ensure certificate chain is complete

# Update web server configuration
# Point to correct certificate files

# Restart web server
systemctl restart apache2  # or nginx
```

### Performance Issues

#### Slow Response Times

**Investigation**:

```bash
# Enable query logging
# In .env: LOG_LEVEL=debug

# Monitor database queries
php artisan db:monitor

# Check server resources
top
htop
iostat
```

**Solutions**:

```bash
# Enable OPcache
# In php.ini:
opcache.enable=1
opcache.memory_consumption=256

# Optimize database
php artisan migrate:status
# Add missing indexes

# Enable caching
# In .env:
CACHE_STORE=redis
# or
CACHE_STORE=file

# Optimize Laravel
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

#### High Memory Usage

**Investigation**:

```bash
# Monitor memory usage
free -h
cat /proc/meminfo

# Check PHP memory usage
php -m | grep memory
```

**Solutions**:

```bash
# Increase PHP memory limit
# In php.ini:
memory_limit = 512M

# Optimize database queries
# Use eager loading to prevent N+1 queries

# Enable garbage collection
# In PHP-FPM pool:
pm.max_requests = 1000
```

### Development Script Issues

#### Composer dev Issues

**Problem**: Composer script fails to execute.

**Solutions**:

```bash
# Check Node.js and npm availability
node --version
npm --version

# Check if concurrently is installed
npx concurrently --version

# Use alternative start method
php artisan serve &
php artisan queue:listen --tries=1 &
npm run dev

# Debug composer script
composer dev --verbose
```

## Diagnostic Commands

### System Information

```bash
# PHP information
php --version
php --modules
php --ini

# Composer information
composer --version
composer info

# Node.js information
node --version
npm --version

# Database information
mysql --version
php artisan --version

# Web server information
apache2 -v
nginx -v
```

### Laravel Diagnostics

```bash
# Application information
php artisan about

# Environment information
php artisan env

# Database status
php artisan migrate:status

# Queue status
php artisan queue:monitor

# Cache status
php artisan cache:table
```

### Log Analysis

```bash
# View recent Laravel logs
tail -100 storage/logs/laravel.log

# Monitor logs in real-time
tail -f storage/logs/laravel.log

# Search for errors
grep -i error storage/logs/laravel.log

# Analyze access patterns
grep -E "GET|POST" /var/log/apache2/access.log | tail -100
```

## Testing Checklist

### Pre-deployment Checklist

- [ ] All tests pass (`php artisan test --parallel`, `npm run test`)
- [ ] Code style is correct (`.\vendor\bin\pint`, `npm run lint`)
- [ ] No security vulnerabilities (`composer audit`, `npm audit`)
- [ ] Frontend builds successfully (`npm run build`)
- [ ] Database migrations run without errors (`php artisan migrate`)
- [ ] Environment configuration is correct
- [ ] SSL certificate is valid and installed
- [ ] Web server configuration is tested
- [ ] Monitoring and logging are configured

### Post-deployment Checklist

- [ ] Application loads successfully
- [ ] API endpoints respond correctly
- [ ] Database operations work
- [ ] File uploads function properly
- [ ] User authentication works
- [ ] Static assets load correctly
- [ ] SSL certificate is working
- [ ] Security headers are present
- [ ] Performance is acceptable
- [ ] Monitoring alerts are configured

### Development Environment Checklist

- [ ] PHP 8.2+ is installed with required extensions
- [ ] Composer is installed and working
- [ ] Node.js 18+ and npm are installed
- [ ] Database connection is working
- [ ] Storage directories have correct permissions
- [ ] Development servers start successfully
- [ ] Hot module replacement works
- [ ] Tests run successfully
- [ ] Code quality tools work

---

## Getting Help

### Community Resources

- **Laravel Documentation**: [https://laravel.com/docs](https://laravel.com/docs)
- **Vue.js Documentation**: [https://vuejs.org/guide/](https://vuejs.org/guide/)
- **Vite Documentation**: [https://vitejs.dev/guide/](https://vitejs.dev/guide/)

### Project-Specific Help

- **GitHub Issues**: [https://github.com/museumwithnofrontiers/inventory-app/issues](https://github.com/museumwithnofrontiers/inventory-app/issues)
- **API Documentation**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Development Guide**: [Development Setup](development-setup)

### Diagnostic Information for Support

When seeking help, include:

```bash
# System information
php --version
composer --version
node --version
npm --version

# Laravel information
php artisan about

# Error logs
tail -50 storage/logs/laravel.log

# Environment information (sanitized)
cat .env | grep -v PASSWORD | grep -v KEY | grep -v SECRET
```

---

## Next Steps

- [Configuration]({{ '/deployment/configuration' | relative_url }}) - Application configuration
- [Development Setup]({{ '/deployment/development-setup' | relative_url }}) - Development environment
- [Server Configuration]({{ '/deployment/server-configuration' | relative_url }}) - Web server setup

