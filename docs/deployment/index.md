---
layout: default
title: Deployment Guide
nav_order: 60
has_children: true
permalink: /deployment/
---

# Deployment Guide

{: .no_toc }

This section covers local setup and production deployment. Use it as operational reference after reading the [Collaborator Guide]({{ '/collaborators/' | relative_url }}).

## Table of Contents

{: .no_toc .text-delta }

1. TOC
   {:toc}

---

## Overview

The system can be deployed in several configurations:

- **Development** - Dev Container with SQLite and local services.
- **Production** - Windows Server with Apache and MariaDB.
- **Testing** - Isolated test databases through the Laravel test runner.

## Quick Start (Development)

```powershell
git clone https://github.com/metanull/inventory-app.git
cd inventory-app
composer install
npm install
cp .env.example .env
php artisan key:generate
composer dev
```

This starts the Laravel server, asset watcher, and queue worker. Access the main back-office at `http://localhost:8000/admin`.

## Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Server    │    │    Laravel      │    │    Database     │
│  (Apache/Nginx) │◄──►│   Application   │◄──►│   (MariaDB)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │
         ▼                       ▼
    Static Assets          Business Logic
      CSS/JS                 Filament /admin back-office
    Uploaded Images        REST API (/api routes)
                           Authentication & Permissions
```

The Filament `/admin` panel is the primary production UI.

## Security

- Token-based API authentication (Laravel Sanctum)
- Role-based access control (Spatie Permissions)
- HTTPS, CSRF protection, and security headers
- Input validation on all endpoints
- SQL injection prevention via Eloquent ORM

---

## Next Steps

- [Development Setup](development-setup) - Set up a local environment
- [Production Deployment](production-deployment) - Deploy to a Windows Server
- [Configuration](configuration) - Environment and application settings
- [Server Configuration](server-configuration) - Apache/Nginx setup
- [Trusted Proxy Configuration](trusted-proxies) - Reverse proxy support
- [Command Line User Management](command-line-user-management) - Manage users via CLI
- [CORS Configuration](cors-configuration) - Cross-origin request settings
- [Testing Troubleshooting](testing-troubleshooting) - Common testing issues
- [Release and Propagation](release-and-propagation) - How a change travels from this repository to the public websites
