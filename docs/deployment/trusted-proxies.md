---
layout: default
title: Trusted Proxy Configuration
parent: Deployment Guide
nav_order: 5
---

# Trusted Proxy Configuration

## Overview

This Laravel application supports trusted proxy configuration for deployment scenarios where the application runs behind a reverse proxy (such as Apache, Nginx, or a load balancer). This is essential when your Laravel application runs on HTTP internally but is exposed via HTTPS through a proxy.

## Problem Solved

When Laravel runs behind a reverse proxy, it may generate incorrect URLs because:

- The application sees HTTP requests from the proxy instead of HTTPS requests from users
- Asset URLs (CSS, JS) may be generated with HTTP instead of HTTPS
- Redirect URLs may use the wrong protocol
- The wrong host or port may be detected

## Configuration

### Environment Variable

Set the `TRUSTED_PROXIES` environment variable in your `.env` file:

```bash
# Single proxy IP
TRUSTED_PROXIES=192.168.255.1

# Multiple proxies (comma-separated)
TRUSTED_PROXIES=192.168.255.1,10.0.0.0/8,172.16.0.0/12

# CIDR notation supported
TRUSTED_PROXIES=192.168.0.0/16,10.0.0.0/8

# Empty value = no trusted proxies (default)
TRUSTED_PROXIES=
```

### How It Works

The configuration in `bootstrap/app.php` automatically:

1. Reads the `TRUSTED_PROXIES` environment variable
2. Parses comma-separated values
3. Configures Laravel to trust the specified proxy IPs
4. Enables all standard forwarded headers:
   - `X-Forwarded-For` (client IP)
   - `X-Forwarded-Host` (original host)
   - `X-Forwarded-Port` (original port)
   - `X-Forwarded-Proto` (original protocol)

## Production Deployment

### For Your Current Setup

Based on your network configuration where the server IP is `192.168.255.157`, you should set:

```bash
# In your GitHub environment variables
TRUSTED_PROXIES=192.168.255.1
```

This assumes your reverse proxy server is at `192.168.255.1` (the gateway). Adjust based on your actual proxy server IP.

### CI/CD Configuration

Add the `TRUSTED_PROXIES` variable to your GitHub environment `MWNF-SVR`:

1. Go to your repository Settings
2. Navigate to Environments → MWNF-SVR
3. Add environment variable:
   - **Name**: `TRUSTED_PROXIES`
   - **Value**: `192.168.255.1` (or your actual proxy IP)

### Testing the Configuration

After deployment, verify that:

1. CSS and JS assets load via HTTPS
2. All generated URLs use the correct protocol
3. Redirects work properly
4. The admin panel at `/admin` loads correctly, and `/` redirects to it

### Common Proxy IPs to Trust

```bash
# Single reverse proxy
TRUSTED_PROXIES=192.168.255.1

# Multiple proxies in chain
TRUSTED_PROXIES=192.168.255.1,10.0.0.1

# Private network ranges (use carefully)
TRUSTED_PROXIES=10.0.0.0/8,172.16.0.0/12,192.168.0.0/16

# Cloudflare (if using)
TRUSTED_PROXIES=173.245.48.0/20,103.21.244.0/22,103.22.200.0/22
```

## Security Considerations

⚠️ **Important**: Only trust proxy IPs you control. Trusting wrong IPs can lead to:

- IP spoofing attacks
- Incorrect client IP detection
- Security bypasses

**Best Practices**:

- Use specific IP addresses instead of broad ranges
- Regularly audit trusted proxy configuration
- Monitor for unexpected proxy headers
- Test configuration changes in staging first

## Troubleshooting

### Assets Still Load via HTTP

1. Check that `APP_URL` is set to HTTPS in production
2. Verify `TRUSTED_PROXIES` includes your reverse proxy IP
3. Ensure your reverse proxy sends the correct headers
4. Clear Laravel caches: `php artisan config:clear`

### Wrong Client IPs in Logs

1. Verify the proxy IP is trusted
2. Check that `X-Forwarded-For` header is sent by proxy
3. Review proxy configuration for header forwarding

### Redirects Use Wrong Protocol

1. Confirm `X-Forwarded-Proto` header is sent as `https`
2. Verify proxy IP is in trusted list
3. Check Laravel URL generation is using the correct protocol

## Related Documentation

- [Laravel Trusted Proxies Documentation](https://laravel.com/docs/12.x/requests#configuring-trusted-proxies)
- [Laravel Behind a Load Balancer](https://laravel.com/docs/12.x/deployment#nginx)
