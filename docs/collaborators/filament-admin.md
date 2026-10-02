---
layout: default
title: Filament Back-Office
parent: Collaborator Guide
nav_order: 2
---

# Filament Back-Office

Filament `/admin` is the application's only user interface, for content managers and administrators alike. `/` redirects to it.

## Where to work

| Area | Path |
|---|---|
| Filament resources and pages | `app/Filament/` |
| Filament panel provider | `app/Providers/Filament/` |
| Filament auth pages | `app/Filament/Auth/` |
| Filament tests | `tests/Filament/` |
| Policies | `app/Policies/` |

## Authorization model

Filament uses three authorization tiers:

1. Panel access uses the `access-admin-panel` permission.
2. Navigation and resource visibility use feature permissions such as `view-data`, `manage-users`, `manage-roles`, `manage-settings`, and `manage-reference-data`.
3. Record and action authorization uses existing policies in `app/Policies/`.

## Authentication

Every authentication page is a Filament page under `app/Filament/Auth/`:
- login;
- the two-factor challenge and setup;
- password reset and its two-factor step;
- registration.

They are built on Laravel Fortify: they and the profile page call its actions (`CreateNewUser`, `UpdateUserPassword`, `UpdateUserProfileInformation`, the two-factor actions) and its two-factor provider directly. Fortify itself serves no route (`Fortify::ignoreRoutes()`), so don't add one; add a Filament page instead.

- **Registration** is open only while the `self_registration_enabled` setting is on.
- **E-mail verification:** every verification message links to `/admin/email-verification/verify/{id}/{hash}`. The route sits outside the panel's authentication, because a self-registered user verifies before an administrator approves them.
- **The login page** tells the owner of an unverified or unapproved account what is missing.
- **API tokens:** personal access tokens for the API are created and revoked on the API Tokens page, reached from the profile.

## Test placement

Put new Filament tests under `tests/Filament/`.

## Business references

- [Inventory Principles](../understanding/inventory-principles) explains why Filament is the main back-office.
- [Core Model](../understanding/core-model) explains the entities shown in Filament resources.
