---
layout: default
title: ADR 003 — The Filament panel is the only UI
parent: Architecture Decisions
nav_order: 3
---

# ADR 003 — The Filament panel is the only UI

- **Status:** Accepted
- **Date:** 2026-10-02
- **Milestone:** M8 — Retire /web — /admin is the root (epics #1868, #1869, #1870)

## Context

The application had two back-office interfaces:

- **`/web`:** the first one, built from the Jetstream starter kit with Blade views and Livewire components. Its sign-in, registration, password-reset and e-mail verification pages were Laravel Fortify's Blade pages, served under `/web`.
- **`/admin`:** the Filament 3 panel. It took over the back-office in later milestones, with its own login, two-factor, password-reset and profile pages. It is the interface people use and the one developed.

`/web` was no longer used or updated, but it still cost something:

- a second set of controllers, form requests, views, Livewire components and tests to keep compiling;
- a second sign-in flow beside the panel's;
- `/` led to it.

A few things existed only there:
- self-registration;
- the e-mail verification pages;
- the page for creating and revoking personal API tokens.

## Decision

1. **`/web` is removed.** That covers its routes, controllers, form requests, Livewire components, Blade views, front-end bundle and tests. The Filament panel at `/admin` is the application's only UI.
2. **`/` redirects to `/admin`.** `/login` redirects to the panel's login page, because Laravel's guest redirects (the authentication exception handler, and the permission and role middleware) go to the route named `login`.
3. **Fortify stays, without routes.** The panel's authentication is built on it:
   - its pages and the profile page call Fortify's actions (`CreateNewUser`, `UpdateUserPassword`, `UpdateUserProfileInformation`, and the two-factor actions);
   - the two-factor challenge and the mobile API's two-factor step use its `TwoFactorAuthenticationProvider`;
   - `User` uses its `TwoFactorAuthenticatable` trait.

   Fortify serves no route (`Fortify::ignoreRoutes()`), and its features list keeps only two-factor authentication. `laravel/fortify` is required directly, since composer.json used to get it only through Jetstream.
4. **Jetstream goes.** Once its pages were gone it provided only the profile-photo trait, a delete-user action and its service provider. The panel's profile page replaces all three.
5. **What only `/web` offered moves into the panel:**
   - **Registration:** a Filament page, open only while the `self_registration_enabled` setting is on. It doesn't sign the new user in.
   - **E-mail verification:** a route at `/admin/email-verification/verify/{id}/{hash}`, outside the panel's authentication. A self-registered user verifies before an administrator approves them, and `User::canAccessPanel()` turns away anyone unverified or unapproved. The signature and the hash of the address prove the link. Every verification message points there.
   - **The login page** tells the owner of an unverified account (sending a new link) or of an account awaiting approval what is missing.
   - **API tokens:** an API Tokens page, reached from the profile, creates, lists and revokes personal access tokens.
   - **The self-registration setting** opens to `manage settings` as well as `manage users`, matching both interfaces' former gates.

## Consequences

- **One interface, one sign-in flow:** there is no `/web` session, route or view left to keep separate from the panel.
- **No UI outside the panel.** New back-office features are Filament resources or pages. New authentication pages are Filament pages that call Fortify's actions; no Fortify route is added back.
- **`GET /api/user` no longer returns `profile_photo_url`,** Jetstream's generated avatar link: photo upload was never enabled. No data-model change: the `profile_photo_path` and `current_team_id` columns stay.
- **Personal API token abilities are not carried over.** Nothing checked them; a token created on the panel gets Sanctum's default, like a mobile token.
- **The version footer `/web` showed has no counterpart.** The version remains at `/api/version`.
- **Front end and tests:** the front-end bundle is the panel's Tailwind theme alone. The `Web` test suite is gone; its API and permission tests moved to the `Api` and `Unit` suites.
- **Deploys:** the OVH deploy ends with a smoke check that `/` redirects to `/admin` and that `/admin/login` answers.

## References

- [Filament Back-Office]({{ '/collaborators/filament-admin' | relative_url }}): authorization and authentication in the panel.
- Milestone 3, "Full Migration to Filament — Unified Admin UI", where this record was first planned (#954).
