# Web Server Configuration Files

This directory contains sample web server configuration files for deploying the Inventory Management Laravel application.

## Files

- **`apache.conf`** - Apache virtual host configuration for Linux/Unix systems
- **`apache-windows.conf`** - Apache virtual host configuration for Windows servers
- **`nginx.conf`** - Nginx server block configuration

## Prerequisites

### For Apache
- Apache 2.4 or higher
- PHP 8.2 or higher
- Required Apache modules:
  - `mod_rewrite` (for URL rewriting)
  - `mod_ssl` (for HTTPS)
  - `mod_headers` (for security headers)
  - `mod_expires` (for cache headers)

### For Nginx
- Nginx 1.18 or higher
- PHP 8.2 or higher with PHP-FPM
- SSL certificate (for production)

### OVH Reference Host

The current OVH host for `inventory.metanull.eu` runs Ubuntu 26.04 with
PHP-FPM. The exact PHP minor is set once, in one place —
`scripts/provision.sh`'s `PHP_VERSION` — and mirrored by `.docker/Dockerfile`'s
`FROM php:` tag and every CI `php-version` input; see
[Server Configuration](../docs/deployment/server-configuration.md)
for the authoritative, currently-maintained walkthrough (socket paths,
PHP-FPM pool config, Nginx/Apache blocks). Don't hardcode a PHP minor here —
it drifts exactly like the one this file used to carry.

## Installation Instructions

### Apache (Linux/Unix)

1. Copy the configuration file:
   ```bash
   sudo cp apache.conf /etc/apache2/sites-available/inventory-app.conf
   ```

2. Update the configuration:
   - Change `ServerName` to your domain
   - Update `DocumentRoot` to your application's public directory
   - Update SSL certificate paths (for HTTPS)

3. Enable required modules:
   ```bash
   sudo a2enmod rewrite ssl headers expires
   ```

4. Enable the site:
   ```bash
   sudo a2ensite inventory-app
   ```

5. Reload Apache:
   ```bash
   sudo systemctl reload apache2
   ```

### Apache (Windows)

1. Open `httpd-vhosts.conf` or create a new configuration file

2. Copy the content from `apache-windows.conf`

3. Update the configuration:
   - Change `ServerName` to your domain or IP
   - Update `DocumentRoot` to your application's public directory (use Windows paths)
   - Update SSL certificate paths (for HTTPS)
   - Update log file paths

4. Ensure required modules are enabled in `httpd.conf`:
   ```apache
   LoadModule rewrite_module modules/mod_rewrite.so
   LoadModule ssl_module modules/mod_ssl.so
   LoadModule headers_module modules/mod_headers.so
   LoadModule expires_module modules/mod_expires.so
   ```

5. Restart Apache service

### Nginx

1. Copy the configuration file:
   ```bash
   sudo cp nginx.conf /etc/nginx/sites-available/inventory-app
   ```

2. Update the configuration:
   - Change `server_name` to your domain
   - Update `root` to your application's public directory
   - Update SSL certificate paths
   - Update PHP-FPM socket path if needed

3. Enable the site:
   ```bash
   sudo ln -s /etc/nginx/sites-available/inventory-app /etc/nginx/sites-enabled/
   ```

4. Test the configuration:
   ```bash
   sudo nginx -t
   ```

5. Reload Nginx:
   ```bash
   sudo systemctl reload nginx
   ```

## Configuration Details

### Security Features

All configurations include:
- **Security headers**: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, HSTS
- **File access restrictions**: Prevent access to sensitive files and directories
- **SSL/TLS configuration**: Modern cipher suites and protocols
- **Server information hiding**: Reduce information disclosure

### Performance Optimizations

- **Static file caching**: Long-term caching for CSS, JS, and image files
- **Gzip compression**: (Nginx) Compress text-based files
- **HTTP/2 support**: (Nginx) Improved performance for modern browsers

### Laravel-Specific

- **URL rewriting**: Proper handling of Laravel's pretty URLs
- **PHP configuration**: Optimized for Laravel applications
- **Directory protection**: Prevent access to Laravel's internal directories

## Customization

### Domain and Paths

Update these values in your chosen configuration file:
- `ServerName` / `server_name`: Your domain name
- `DocumentRoot` / `root`: Path to your application's `public` directory
- Log file paths: Customize logging locations
- SSL certificate paths: Point to your SSL certificates

### PHP Configuration

For Apache:
- Update PHP-FPM socket path in `SetHandler` directive
- Adjust FastCGI timeout values if needed

For Nginx:
- Update `fastcgi_pass` to match your PHP-FPM configuration
- Adjust timeout values for large file uploads or long-running requests

### SSL Certificates

For production deployments:
1. Obtain SSL certificates from a Certificate Authority (Let's Encrypt, etc.)
2. Update certificate paths in the configuration
3. Enable HTTPS redirect by uncommenting the redirect sections

## Testing

After configuration:

1. **Test web server configuration**:
   ```bash
   # Apache
   sudo apache2ctl configtest
   
   # Nginx  
   sudo nginx -t
   ```

2. **Verify Laravel application**:
   - Access your domain in a browser
   - Check that static assets load correctly
   - Verify API endpoints work
   - Test HTTPS redirect (if configured)

3. **Check security headers**:
   ```bash
   curl -I https://your-domain.com
   ```

## Troubleshooting

### Common Issues

1. **404 errors**: Check that `mod_rewrite` (Apache) is enabled and URL rewriting rules are correct
2. **403 Forbidden**: Verify directory permissions and web server user has access
3. **500 errors**: Check Laravel logs in `storage/logs/` and web server error logs
4. **Static files not loading**: Verify build files exist in `public/build/` directory

### Laravel Requirements

Ensure your Laravel application is properly configured:
- Run `composer install --optimize-autoloader --no-dev`
- Run `npm run build` to build frontend assets
- Set proper file permissions on `storage/` and `bootstrap/cache/`
- Configure your `.env` file with correct database and application settings

## Production Checklist

- [ ] SSL certificate installed and configured
- [ ] HTTPS redirect enabled
- [ ] Security headers configured
- [ ] File permissions set correctly
- [ ] Laravel optimizations applied (`php artisan optimize`)
- [ ] Frontend assets built (`npm run build`)
- [ ] Database migrations run
- [ ] Backup strategy in place
- [ ] Monitoring and logging configured

## Support

For Laravel-specific configuration questions, refer to the [Laravel Deployment Documentation](https://laravel.com/docs/deployment).

For web server specific issues, consult:
- [Apache Documentation](https://httpd.apache.org/docs/)
- [Nginx Documentation](https://nginx.org/en/docs/)

