# Threat model

The OSS Scanner reads this file before it starts. It covers the Museum With No Frontiers Inventory Management
System: a Laravel 12 application with a Filament 3 admin panel and a JSON API, run by MWNF staff and partner
institutions to catalogue museum objects, their translations and their images.

## Where the code is

| Path | What it is |
| --- | --- |
| `/src` | The checkout, built: `vendor/` with dev dependencies, the Vite/Filament theme in `public/build/`, a `.env` for a local site. |
| `/src/database/scan.sqlite` | The database of the running site, migrated and seeded with the roles, permissions and two test accounts below. |
| `/src/scripts/importer` | The legacy-data importer (TypeScript, Node 24), with `node_modules` installed. |

Start the site with `inventory-start`. It listens on `http://127.0.0.1:8000/`, and `/` redirects to the panel at `/admin`.

| Account | Password | Role | What it can do |
| --- | --- | --- | --- |
| `user@example.com` | `password` | Manager of Data | panel access, create/read/update/delete all data, reference data included |
| `admin@example.com` | `password` | Superadmin | user accounts and their role only (the other user managers included), no data access |
| (anonymous) | | | the public endpoints listed below |

A user holds exactly one role, or none (no access). `php artisan user:set-role <email> "<role>"` changes it; the other roles are
`Visitor` (reads everything, changes nothing) and `Manager of Users` (accounts only). Roles and permissions are defined in
`app/Enums/Role.php` and `app/Enums/Permission.php`.

Run the tests with `php artisan test --testsuite=<Unit|Api|Filament|Configuration|Console|Event|Integration>`.
`phpunit.xml` and `tests/bootstrap.php` force sqlite `:memory:` and fake the storage disks, so the tests never touch
the site's database or files.

## Where untrusted input enters

- **Anonymous HTTP.** The unauthenticated surface:
  - `/pub/{filename}` (`routes/pub.php`, `App\Http\Controllers\Pub\PictureController`) serves every attached image. The copyright is burned in on demand and the rendition is cached on the public disk.
  - The REST API under `/api` is switched off unless `API_ENABLED` is set (`config/api.php`). While it is off, `App\Http\Middleware\EnsureApiEnabled` answers 404 for every `/api` route, ahead of authentication. When it is on, its unauthenticated routes are:
    - `/api/info`, `/api/health`, `/api/version`.
    - `/api/markdown/*`: Markdown to and from HTML conversion and validation.
  - `/api.json`: the OpenAPI document.
  - The Filament login, registration, password-reset, e-mail-verification and MFA pages under `/admin` (`app/Filament/Auth/`, which call Fortify's actions directly; Fortify serves no route of its own).
- **Authenticated users with low privilege.** A `Visitor` account, or an account with no role, must not reach data or actions beyond its role. The policies (`App\Policies\*`) are the only authorization mechanism, on the panel, the API and the MCP server alike:
  1. `access-admin-panel` and `access-mcp` gate `/admin` and the MCP server, for active accounts only (verified, approved, not suspended).
  2. The panel's navigation and resources ask the policies (`viewAny`); a model without a policy is denied.
  3. The policies decide every record-level action. Account rules (`App\Policies\UserPolicy`): only the superadmin changes another user manager, nobody changes the superadmin or their own role.

  The API asks the policies on every data route (`App\Http\Middleware\AuthorizeApiRequest`) behind `auth:api` (OAuth bearer tokens issued by Passport), an account-state check and an OAuth scope check (`api:read` for reads, `api:write` for writes). It serves no user, role or permission management.
- **Uploaded files.** Images enter through `POST /api/image-upload` and the panel. The pipeline is `ImageUpload` (private `local` disk), then `ImageUploadEvent`, then `ImageUploadListener` (validates and re-encodes with GD, creates the `AvailableImage`), then `AvailableImageListener` (moves the file to the private originals disk). Documents (PDF) follow `DocumentUploadListener`. The client-supplied filename, extension and MIME type are untrusted.
- **Stored content shown to other users.** This includes item and collection texts, translations, Markdown fields, glossary entries, partner data, tags and copyright strings. Copyright strings are also drawn into public images.

## Components that matter most

1. **Image storage and serving** (`app/Support/Images/`, `app/Http/Controllers/Pub/`, `app/Listeners/`, the `*Image` models). The design rules are strict:
   - Originals live on private disks and must never be web-reachable.
   - The public `pictures/` disk holds only burned renditions written by `App\Support\Images\PublicRenditions`.
   - An attached image must never be served publicly other than as its burned rendition. The exception is `PartnerLogo`, which is served unburned by design.

   Path traversal, a way to fetch an original or an unattached upload through `/pub` or the API, a way to write to the public disk, cache poisoning of renditions, and decompression or GD memory bombs are all in scope.
2. **Authentication and authorization.** In scope:
   - Bypassing a permission tier or a policy.
   - Privilege escalation between roles.
   - Self-registration granting access before verification.
   - MFA bypass on the panel.
   - Reaching any `/api` route while the API is switched off.
   - OAuth token misuse: a grant other than authorization code (`App\Support\OAuth\AuthorizationCodeClient`), a token used beyond its scopes, a revoked token still accepted.
   - Mass assignment in Form Requests.
   - IDOR on UUID-keyed records.
3. **The JSON API** (`routes/api.php`, `app/Http/Controllers`, `app/Http/Requests/Api`). In scope: injection, broken validation, and leaking data through `include=` relations or pagination.
4. **Markdown and HTML handling.** The public `/api/markdown/*` converters and any field rendered as HTML in the panel. Stored XSS that runs in a staff member's panel session is high.

## Components that matter less, or are out of scope

- `scripts/importer`. Run only by operators against the legacy MWNF databases, it is in scope but lower priority. Treat its input (legacy database rows, images) as semi-trusted.
- `docs/` (the Jekyll site), `scripts/exporters`, `scripts/viewers`, `scripts/site-i18n` and the deployment workflows are out of scope. Only the GitHub Pages documentation is built from them.
- `.legacy-*` and `.new-architecture/*` are git submodules of other projects. They are not cloned and are out of scope.
- `.env.local.example`, `.env.testing` and `.env.ci` carry fixed example keys and the `password` test accounts. They are development fixtures, never used in production, and not findings in themselves.

## How we rate severity

- **Critical.** Remote code execution. Unauthenticated access to originals, private uploads or non-public data. Authentication bypass. Unauthenticated writes.
- **High:**
  - Privilege escalation from a low-privilege role (Visitor, no role) to data writes or account management, or from a Manager of Users to data or to the superadmin.
  - Bypassing MFA.
  - Stored XSS reaching another user's panel session.
  - SQL injection behind authentication.
  - Writing arbitrary files to the public disk.
- **Medium:**
  - Information disclosure to an authenticated user beyond their permissions.
  - CSRF on state-changing panel actions.
  - Cache poisoning of `/pub` renditions.
  - Reflected XSS.
- **Low:**
  - Denial of service that an authenticated user needs to trigger, or that rate limiting (`throttle:pub-pictures` and others) already bounds.
  - Missing hardening headers.
  - Verbose errors.

## Anything to leave alone

- Do not report `APP_DEBUG=true` or the seeded `password` accounts in this scan image. The image is a local site built for the scan.
- `/api.json` and `/api/info|health|version` are public by design.
- `PartnerLogo` being served unburned at `/pub` is by design.
