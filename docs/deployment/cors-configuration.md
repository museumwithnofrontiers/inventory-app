---
layout: default
title: CORS Configuration
parent: Deployment Guide
nav_order: 6
---

# CORS Configuration

## Overview

Cross-Origin Resource Sharing (CORS) allows the API to accept requests from frontend applications hosted on different domains. This is essential when deploying client applications separately from the API backend, such as on GitHub Pages, Netlify, or other hosting platforms.

## Problem Solved

By default, web browsers block cross-origin HTTP requests initiated from scripts for security reasons. Without proper CORS configuration:

- Frontend applications on different domains cannot access the API
- Authentication requests fail
- AJAX calls return CORS errors in browser console
- API endpoints return "No 'Access-Control-Allow-Origin' header" errors

## Configuration

### Environment Variable

Set the `CORS_ALLOWED_ORIGINS` environment variable in your `.env` file:

```bash
# Single origin
CORS_ALLOWED_ORIGINS=https://metanull.github.io

# Multiple origins (comma-separated)
CORS_ALLOWED_ORIGINS=https://metanull.github.io,https://app.example.com

# Development and production origins
CORS_ALLOWED_ORIGINS=http://localhost:5174,https://metanull.github.io/inventory-management-ui

# Empty value = no origins allowed (default - only same-origin allowed)
CORS_ALLOWED_ORIGINS=
```

### How It Works

The CORS configuration in `config/cors.php`:

1. Reads `CORS_ALLOWED_ORIGINS` environment variable
2. Parses comma-separated origin URLs
3. Applies CORS headers to API routes (`api/*`) and authentication endpoints (`sanctum/csrf-cookie`)
4. Enables credential support for cookie-based authentication

CORS headers applied:

- `Access-Control-Allow-Origin` - Allowed origin domains
- `Access-Control-Allow-Methods` - All HTTP methods
- `Access-Control-Allow-Headers` - All request headers
- `Access-Control-Allow-Credentials` - Enables cookie/token authentication

## Production Deployment

### For GitHub Pages Client App

If deploying a client application at `https://metanull.github.io/inventory-management-ui/`:

```bash
CORS_ALLOWED_ORIGINS=https://metanull.github.io
```

**Note**: Use the root domain (`metanull.github.io`), not the full path with subdirectory.

### CI/CD Configuration

Add the `CORS_ALLOWED_ORIGINS` variable to your GitHub environment `MWNF-SVR`:

1. Go to your repository Settings
2. Navigate to Environments → MWNF-SVR
3. Add environment variable:
   - **Name**: `CORS_ALLOWED_ORIGINS`
   - **Value**: `https://metanull.github.io`

The deployment workflow automatically includes this configuration in the `.env` file.

### Multiple Client Applications

For multiple frontend deployments:

```bash
# Production, staging, and development clients
CORS_ALLOWED_ORIGINS=https://metanull.github.io,https://staging.example.com,http://localhost:5174
```

### Testing the Configuration

After deployment, verify CORS is working:

1. Open browser DevTools Console
2. Navigate to your client application
3. Make an API request
4. Check Network tab for response headers:

   ```
   Access-Control-Allow-Origin: https://metanull.github.io
   Access-Control-Allow-Credentials: true
   ```

5. Verify no CORS errors in Console

## Common CORS Origins

```bash
# GitHub Pages (user site)
CORS_ALLOWED_ORIGINS=https://username.github.io

# GitHub Pages (project site)
CORS_ALLOWED_ORIGINS=https://username.github.io

# Netlify
CORS_ALLOWED_ORIGINS=https://app-name.netlify.app

# Vercel
CORS_ALLOWED_ORIGINS=https://app-name.vercel.app

# Custom domain
CORS_ALLOWED_ORIGINS=https://app.yourdomain.com

# Multiple environments
CORS_ALLOWED_ORIGINS=https://username.github.io,https://staging.example.com,https://app.example.com
```

## Security Considerations

⚠️ **Important**: Only allow origins you control. Allowing untrusted origins can lead to:

- Unauthorized API access from malicious sites
- Data exposure to third parties
- CSRF attacks if combined with weak authentication

**Best Practices**:

- Use specific domain names, not wildcards
- Include protocol (`https://`) in origin URLs
- Regularly audit allowed origins
- Remove unused origins from configuration
- Use environment-specific configurations (dev vs. prod)
- Never use `*` (all origins) in production

## Troubleshooting

### CORS Error in Browser

**Error**: "Access to fetch at 'https://api.example.com' from origin 'https://app.example.com' has been blocked by CORS policy"

**Solutions**:

1. Verify origin is in `CORS_ALLOWED_ORIGINS`
2. Check protocol matches (`http` vs `https`)
3. Ensure no trailing slashes in origin URLs
4. Clear Laravel config cache: `php artisan config:clear`
5. Restart web server after configuration changes

### Credentials Not Included

**Error**: "Credentials flag is 'true', but the 'Access-Control-Allow-Credentials' header is ''"

**Solutions**:

1. Verify `supports_credentials => true` in `config/cors.php`
2. Ensure frontend sends credentials:
   ```typescript
   axios.get("/api/endpoint", { withCredentials: true });
   ```
3. Check Sanctum configuration for stateful domains

### Preflight Request Fails

**Error**: "Response to preflight request doesn't pass access control check"

**Solutions**:

1. Verify `OPTIONS` method is allowed in CORS config
2. Check web server allows OPTIONS requests
3. Ensure API routes don't require authentication for preflight
4. Test with `curl -X OPTIONS` to debug

### Mixed Content Errors

**Error**: "Mixed Content: The page at 'https://...' was loaded over HTTPS, but requested an insecure resource"

**Solutions**:

1. Ensure API uses HTTPS in production
2. Update `APP_URL` to use `https://`
3. Configure trusted proxies if behind reverse proxy
4. Check that all asset URLs use HTTPS

## Advanced Configuration

### Custom Headers

Modify `config/cors.php` to expose custom headers:

```php
'exposed_headers' => ['X-Custom-Header', 'X-Rate-Limit'],
```

### Preflight Caching

Enable preflight caching to reduce OPTIONS requests:

```php
'max_age' => 86400, // Cache for 24 hours
```

### Origin Patterns

For dynamic subdomains, use patterns:

```php
'allowed_origins_patterns' => ['/^https:\/\/.*\.example\.com$/'],
```

## Development vs. Production

### Development

```env
# Allow localhost for development
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:5174,http://127.0.0.1:5173
```

### Production

```env
# Only allow production domains
CORS_ALLOWED_ORIGINS=https://metanull.github.io,https://app.example.com
```

### Environment-Specific .env Files

Use separate `.env` files for each environment:

- `.env.local` - Development
- `.env.staging` - Staging
- `.env.production` - Production

## Related Documentation

- [Mozilla CORS Documentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [Laravel CORS Package](https://github.com/fruitcake/laravel-cors)
- [Trusted Proxy Configuration](/deployment/trusted-proxies)

## GitHub Pages Deployment Example

Complete workflow for deploying client app to GitHub Pages:

1. **Configure API CORS** (this guide):

   ```bash
   CORS_ALLOWED_ORIGINS=https://metanull.github.io
   ```

2. **Deploy API backend** with updated `.env`

3. **Configure client app** with API URL:

   ```env
   VITE_API_BASE_URL=https://api.example.com
   ```

4. **Build and deploy** client to GitHub Pages

5. **Test** API access from deployed app

See [GitHub Pages Deployment Guide](https://docs.github.com/en/pages) for client deployment details.
