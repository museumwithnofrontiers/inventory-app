---
layout: default
title: Filament Back-Office
parent: Collaborator Guide
nav_order: 2
---

# Filament Back-Office

The Filament 5 panel at `/admin` (on Livewire 4) is the application's only user interface, for content managers and administrators alike. `/` redirects to it.

## Where to work

| Area | Path |
|---|---|
| Filament resources and pages | `app/Filament/` |
| Filament panel provider | `app/Providers/Filament/` |
| Filament auth pages | `app/Filament/Auth/` |
| Filament tests | `tests/Filament/` |
| Policies | `app/Policies/` |

## Authorization model

The policies in `app/Policies/` are the only authorization mechanism, on the panel, the REST API and the MCP server alike. A user holds exactly one role (`app/Enums/Role.php`: Visitor, Manager of Data, Manager of Users, Superadmin), and the role carries the permissions the policies read (`app/Enums/Permission.php`).

1. Panel access needs an active account (verified, approved, not suspended) and the `access-admin-panel` permission.
2. Navigation and resource visibility ask the policies: a resource's `getViewAnyAuthorizationResponse()` returns `Gate::inspect('viewAny', static::getModel())`. Filament reads its `get*AuthorizationResponse()` methods and no longer calls `can*()` overrides, so a resource or relation manager overrides the response methods, never a `can*()` method.
3. Records and actions ask the policies too. Every data model has a policy (`App\Policies\DataPolicy`); a model without one is denied, in Filament as everywhere else. A custom action carries `->visible()` and `->authorize()` from its policy.

Relation managers use `App\Filament\Concerns\AuthorizesRelationMutations`: every mutation needs `update` on the record that owns the relation. Filament itself checks only `isReadOnly()` for Attach, Detach, Associate and Dissociate, so the concern routes those through the same check (`getDefaultActionAuthorizationResponse()`).

## Panel defaults

The panel keeps Filament 3's defaults where Filament 4 changed them (`AdminPanelProvider::keepFilament3Defaults()`):
- sections, grids and fieldsets span the whole row;
- table filters apply at once (not deferred);
- the page size offers "All";
- no primary-key sort is added behind a table's own sort;
- `unique()` checks every record unless the field passes `ignoreRecord: true`;
- an inline radio puts its label inline too.

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
- **Connected apps:** apps you authorized through OAuth, such as an AI assistant connected to the MCP server, are listed on the Connected apps page, reached from the profile or the user menu. Revoke ends an app's access at once.

## Test placement

Put new Filament tests under `tests/Filament/`.

## Business references

- [Inventory Principles](../understanding/inventory-principles) explains why Filament is the main back-office.
- [Core Model](../understanding/core-model) explains the entities shown in Filament resources.
