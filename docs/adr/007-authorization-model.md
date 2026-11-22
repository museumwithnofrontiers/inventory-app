---
layout: default
title: ADR 007 — Authorization model
parent: Architecture Decisions
nav_order: 7
---

# ADR 007 — Authorization model

- **Status:** Accepted (Pascal, 2026-11-22)
- **Date:** 2026-11-22

## Context

An assessment of the panel, the REST API and the MCP server (2026-11-22) found the three-tier model sound, but enforced unevenly:

- four panel actions and the Available Images resource let a read-only user change data, because Filament allows any action on a model without a policy;
- the REST API never asked the policies;
- suspending a user left their OAuth tokens working;
- the user manager could give themselves any role or permission;
- the roles were defined in three places that had drifted.

## Decision

1. **Four roles, defined in code** (`App\Enums\Role`), and nowhere else. `RoleSync` keeps the database on them. The seeders, the migrations, `permissions:sync` and every deploy call it, so nothing drifts. The panel shows the roles read-only.
   - **Visitor** reads everything, reference data included, and changes nothing.
   - **Manager of Data** reads and changes all inventory data.
   - **Manager of Users** is break-glass: accounts and their role, the self-registration switch and the audit log. It has no data access.
   - **Superadmin** is one user: the first Manager of Users ever created. The other user managers cannot change it, and it manages them. It moves only with `php artisan user:superadmin`.
2. **One role per user, or none** (a unique index on `model_has_roles`). With no role, an account has no access. New users get no role until a user manager assigns one. Permissions are never given to a user directly.
3. **The policies are the only authorization mechanism**, on the panel, the REST API and the MCP server alike.
   - Every data model has one (`DataPolicy`).
   - A missing policy denies, in Filament too.
   - Resource visibility is the policy's `viewAny`.
   - The API asks the policies on every data route (`AuthorizeApiRequest`).
4. **Account rules** (`UserPolicy`):
   - Nobody changes their own role, or suspends or deletes themselves.
   - Only the superadmin changes another user manager or gives the Manager of Users role.
   - Nobody changes the superadmin in the panel.
   - Sensitive changes ask for the actor's password: another user's e-mail, password or role, a 2FA reset, a suspension or a deletion.
5. **The API never edits users, roles or permissions.** It only reads the signed-in user's own profile, role and permissions. Self-service profile changes happen in the panel only.
6. **Everything about accounts is logged** (`audit_logs`). User managers read the log; nobody can change or delete an entry. The log covers:
   - every change to a user and to their role;
   - every revocation;
   - every run of a `user:`, `permissions:`, `auth:` or `passport:` command, with the server account that ran it.
7. **Disabling an account cuts it off.** Suspending a user revokes their sessions, OAuth access and refresh tokens, and authorization codes. The API and the MCP server refuse any account that is not active.

## Consequences

- The Visitor reads reference data and item documents on every surface; the Manager of Users reads no data, original images included.
- `manage-reference-data`, `assign roles`, `manage roles`, `manage settings`, `view user management` and `view role management` are gone, as are the `Regular User` (now `Manager of Data`) and `Non-verified users` roles. The migration `2026_11_22_200100_one_role_per_user` converts existing accounts:
  - a user who held several roles keeps the highest;
  - the first Manager of Users becomes the superadmin.
- `AuditLog` has no API resource or controller, against the usual rule for new models: the API serves no account data (point 5).
- `/pub` still serves every attached image whatever its draft status: the unguessable filename is the capability (ADR 005, ADR 006).
