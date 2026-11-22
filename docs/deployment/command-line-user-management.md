---
layout: default
title: Command Line User Management
parent: Deployment Guide
nav_order: 8
---

# Command Line User Management

This guide covers the Artisan commands that manage accounts, roles and permissions. Whoever can reach the server can run them; every run is written to the audit log, with the server account and host that ran it.

## Table of Contents

{: .no_toc .text-delta }

1. TOC
   {:toc}

---

## Roles

There are four roles, defined in code (`app/Enums/Role.php`) and nowhere else. A user holds exactly one role, or none: with no role, the account has no access at all.

| Role | What it may do |
|---|---|
| **Visitor** | Reads all inventory data, reference data included; changes nothing |
| **Manager of Data** | Reads and changes all inventory data; no access to accounts |
| **Manager of Users** | Manages user accounts and their role, reads the audit log; no access to inventory data |
| **Superadmin** | Everything a Manager of Users may do, plus the accounts of the other user managers. Exactly one user holds it |

In the panel, nobody changes their own role, only the superadmin changes another user manager, and nobody changes the superadmin. The superadmin role moves only with `user:superadmin`.

The REST API never edits users, roles or permissions: it only reads the signed-in user's own profile, role and permissions.

## Initial Setup

After a fresh deployment:

```powershell
# 1. Run migrations (they also create the roles and permissions)
php artisan migrate --force

# 2. Make sure the roles and permissions match their definitions (deploys run it too)
php artisan permissions:sync

# 3. Create the first user; an invitation e-mail lets them set their password
php artisan user:create "System Administrator" admin@company.com

# 4. Make them the superadmin
php artisan user:superadmin admin@company.com

# 5. Verify
php artisan user:show admin@company.com
```

## User Commands

```powershell
# Create a user (no role yet); an invitation e-mail is sent
php artisan user:create "User Name" user@company.com

# Set a user's role, replacing the one they hold
php artisan user:set-role user@company.com "Manager of Data"

# Take a user's role away (no access)
php artisan user:remove-role user@company.com

# Make a user the superadmin; the previous superadmin becomes a Manager of Users
php artisan user:superadmin user@company.com

# Show a user, their role and permissions
php artisan user:show user@company.com

# List users, optionally by role
php artisan user:list
php artisan user:list --role="Manager of Users"

# Verify, unverify or show a user's e-mail verification
php artisan user:email-verification user@company.com verify
```

`user:assign-role` is an alias of `user:set-role`. Neither gives the superadmin role, and neither changes the superadmin's role.

## Roles and Permissions

```powershell
# Make the roles and permissions in the database match App\Enums\Role and
# App\Enums\Permission. Idempotent; never changes who holds which role
php artisan permissions:sync
```

The panel shows the roles and their permissions read-only. To change what a role may do, change `app/Enums/Role.php` and deploy: every deploy runs `permissions:sync`.

## Auth Snapshots

```powershell
# Create an encrypted auth snapshot before a destructive reset
php artisan auth:snapshot auth-snapshots/pre-reset.json.enc --force

# Full database reset and seed (CAUTION: deletes all data)
php artisan migrate:fresh --seed

# Restore the snapshot after the migrations
php artisan permissions:sync
php artisan auth:restore auth-snapshots/pre-reset.json.enc --force
```

Auth snapshots preserve user accounts, MFA setup and role assignments. OAuth grants are not kept: a restore revokes every OAuth token, so connected apps sign in again. The snapshot is encrypted with Laravel's current `APP_KEY`, but the `APP_KEY` is not stored in the file. Restore the snapshot only into an application that uses the same `APP_KEY`.

## Suspending a User

Suspend a user in the panel (Users → Suspend). Their panel sessions, OAuth tokens and authorization codes are revoked at once, so MCP clients and API apps stop working too, and the API and the MCP server refuse any account that is not active (e-mail verified, approved, not suspended).

## Troubleshooting

**"Role does not exist"**: run `php artisan permissions:sync`.

**A user cannot access the system**: run `php artisan user:show user@company.com`. They need a role, a verified e-mail and an approval, and must not be suspended.

## Integration with the Admin Panel

The admin panel at `/admin` is the application's only user interface. User managers sign in there and:

- manage users and their role at `/admin/users`;
- look at the roles and their permissions at `/admin/roles` (read-only);
- approve or reject self-registered accounts on the Pending Registrations page;
- read the audit log at `/admin/audit-logs`.
