This document defines how Claude must interact with this repository.
It is a behavioral contract for all AI assistance.

Follow these rules strictly when generating code, explanations, refactors, or reviews.

## Repository Identity & Scope

This monorepo contains the backend and frontend for the Museum With No Frontiers — Inventory Management System.

### Primary components (in-scope):
- Laravel 12 backend + API
- Filament 3 admin panel (/admin)
- Data importer scripts (scripts/importer/)
- Documentation site (docs/, Jekyll)

### Secondary components (out-of-scope unless explicitly asked):
- /web (legacy Jetstream/Blade/Livewire UI)

If unsure whether something is in-scope you must ask the quesiton to the user.

## Filament‑First Architecture (Critical)

The Filament admin panel under /admin is the ONLY active UI. It is accessible to all authenticated users

You must:
1. Always use Filament patterns: Resources, Info Lists, Relation Managers, Pages, Forms & Tables, Actions
2. Never use or reference legacy UI (it is exposed under /web route, and uses Jetstream,Blade and Livewire): Jetstream profile pages, Blade auth views, Livewire list components, SearchableSelect, SearchAndPaginate, IndexListRequest, {Entity}IndexQuery, Any /web/* route or component
3. Respect authentication flow isolation: /admin uses Filament-native login + MFA. Never redirect or share session with /web. Never use references to Blade auth templates

## Authorization Model

You must respect the 3-tier permission system:

1. Tier 1 — Panel Access:
   1. access-admin-panel
   2. controls entry to `/admin`.
2. Tier 2 — Navigation & Resource Visibility
   1. Permissions like: view-data, manage-users, manage-roles, manage-settings, manage-reference-data
   2. These drive: canViewAny(), shouldRegisterNavigation()
3. Tier 3 — Record-level Authorization
   1. Existing App\Policies\* must be used unchanged.
   2. Never bypass or duplicate authorization logic.
   
## Image Upload Pipeline (Extremely Strict)

This is a security boundary.
Never propose shortcuts or alternative flows.

**Three disks:**
1. Uploads: `localstorage.uploads.images` (private `local` disk, `image_uploads/`). Transient.
2. Originals: `localstorage.available.images` (private `image-originals` disk, `images/`). The pristine file of every AvailableImage and every attached image. Never web-reachable.
3. Pictures: `localstorage.pictures` (`public` disk, `pictures/`). Only a cache of burned renditions, written only by `App\Support\Images\PublicRenditions`.

**Canonical pipeline (must always be followed)**:
1. User uploads → ImageUpload (private uploads disk)
2. ImageUploadEvent
3. ImageUploadListener → validates, resizes, creates AvailableImage, deletes ImageUpload, dispatches AvailableImageEvent
4. AvailableImageListener → moves the file from the uploads disk to the private originals disk
5. Entities attach images with `attachFromAvailableImage()` and detach them with `detachToAvailableImage()`. Both exist on every `*Image` model: ItemImage, CollectionImage, PartnerImage, PartnerTranslationImage, ContributorImage and TimelineEventImage (DetachableImage).
   - Both are row swaps: the id, path and copyright carry over, and the original never moves.
   - Detaching also removes the burned rendition from the pictures cache.
6. Deleting an attached image removes its original and its burned rendition (DeletesImageFilesOnDelete).
   - A row removed by a database cascade skips that hook.
   - `images:cleanup-originals` sweeps the originals this leaves behind, and `images:cleanup-pictures` sweeps the cache.

**Serving:**
- **Stable public URL:** `/pub/{filename}` serves every attached image. The npm data packages bake it in, so it never changes.
- **Burning:** the copyright is burned in on demand (ImageBurner) and the rendition is cached.
  - The ETag carries the resolved copyright and `ImageBurner::VERSION`. Bump VERSION whenever the burn output changes.
  - Responses send `Cache-Control: public, no-cache`.
- **API:** the view and download endpoints of the `*Image` models serve the same burned rendition (BurnedImageResponse).
- **Originals:** the admin panel (Filament) view and download serve the original (InlineImageResponse/DownloadImageResponse), as do the AvailableImage and PartnerLogo endpoints.
- **PartnerLogo:** served at `/pub` but never burned. It doesn't implement BurnsCopyright, so `/pub` streams its original.
- **Copyright resolution:** image → owning Project → "© Museum With No Frontiers" (HasCopyright/ResolvesCopyright).

**Hard prohibitions:**
- Never write to the public disk outside the burn pipeline (only PublicRenditions writes the pictures cache)
- Never store an original on the public disk
- Never serve an attached `*Image` publicly other than through PublicRenditions
- Never create AvailableImage manually
- Never use FileUpload->disk('public') in Filament
- Never treat *Image models as pivot tables
- Never reimplement attach/detach logic

**Testing rules:**
- Fake all three disks:
  - `Storage::fake('local')` for uploads;
  - the originals disk (`localstorage.available.images.disk`), which the base TestCase already fakes for every test;
  - `Storage::fake('public')` for pictures.
- tests/bootstrap.php and phpunit.xml pin the image disk variables, so a developer's environment can't change the disks tests use
- Dispatch real events

## Attached Image Contract & Registry

Any model storing an attached image must:
1. Extend Eloquent Model and implement StreamableImageFile, with correct:
   1. imageDisk() and imageStoragePath(): the private original
   2. imageMimeType()
   3. imageDownloadFilename()
2. Implement HasCopyright (use ResolvesCopyright). Also implement BurnsCopyright if its public rendition carries the copyright: every `*Image` model does, PartnerLogo doesn't.
3. Use the DeletesImageFilesOnDelete trait
4. Be added to AttachedImageRegistry. `AttachedImageRegistry::validate()` fails fast on a member missing any of 1 to 3.
5. Have tests covering:
   1. Contract compliance
   2. Registry completeness

Never hardcode lists of image models — always use the registry.

## Code Rules

**Rules**
- No hardcoded secrets — use environment variables.
- Use Laravel abstractions (Storage, Config, etc.).
- Routes use singular nouns: /api/context, /api/language, /api/item
- Every new model must include: migration, factory, seeder, API resource, controller with Form Request validation, tests.

**Models:**
- UUID primary keys for all models except: Language (ISO code), Country (ISO code), User (integer)

**Validation:**
- Always use Form Requests
- No raw SQL — Eloquent only
- Input sanitization at system boundaries only.


**API Controllers:**
- Use App\Http\Requests\Api\*
- Return *Resource
- Support includes & pagination via HasPaginationAndIncludes

## Development Environment

Development tools run inside **Docker**
- .docker/Dockerfile (the `dev` target) is the canonical environment
- No host-side PHP/Node tools

Documentation website tools run inside **Docker**
- .docker/Dockerfile.docs is the canonical environment
- No host-side python/ruby tools

## Git Workflow
You must:
- Never commit to main
- Use feature/* or fix/* branches
- Respect CI constraints (lint, tests, security)

## When Generating Code
You must:
- Always Follow Laravel & Filament best practices
- Always Respect all constraints in this document
- Always Ask for clarification if a change risks violating architecture
- Never Introduce legacy UI patterns
- Never Bypass image pipeline
- Never USer of modify out-of-scope components unless explicitly asked
- Never Suggest raw SQL
- Never Break CI/CD assumptions
