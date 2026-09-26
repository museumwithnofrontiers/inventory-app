---
layout: default
title: Document Upload Pipeline
nav_order: 1
parent: Filament Admin Frontend
---

# Document Upload Pipeline

{: .important }
> This is a **design document**. It specifies the pipeline that [M7 Story A4.2](https://github.com/museumwithnofrontiers/inventory-app/issues/1906) and [M7 Story A4.3](https://github.com/museumwithnofrontiers/inventory-app/issues/1907) implement. It contains no application code, no migration file and no config change of its own — see [Proposed migration](#proposed-migration--needs-pascals-approval) for the one schema change it asks Pascal to approve before A4.2 starts.

Parent epic: [#1875 — M7 Epic A4: Media and documents](https://github.com/museumwithnofrontiers/inventory-app/issues/1875). This story: [#1905](https://github.com/museumwithnofrontiers/inventory-app/issues/1905). Locked decision (2026-09-21): documents get their own epic with a design story first — "own epic, design story first; must mirror the image pipeline's shape (upload → queued pre-processing → only validated files become attachable); validate only what the framework can (size range, extension allowlist e.g. pdf)".

## Where things stand today

- `App\Models\ItemDocument` (`app/Models/ItemDocument.php`, migration `database/migrations/2026_03_29_000017_create_item_documents_table.php`) already exists: UUID PK, `item_id` (FK, cascade), `language_id` (FK, nullable, set-null), `path`, `original_name`, `mime_type`, `size`, `title`, `display_order` (via `HasDisplayOrder`), `extra`, `backward_compatibility`.
- `App\Http\Controllers\ItemDocumentController` (`app/Http/Controllers/ItemDocumentController.php`) is the full API CRUD controller. Its `download()` method is the logic this design reuses:

  ```php
  public function download(ItemDocument $itemDocument): Responsable
  {
      $disk = Config::string('localstorage.documents.disk');
      $directory = trim(Config::string('localstorage.documents.directory'), '/');
      $filename = $itemDocument->original_name ?: basename($itemDocument->path);
      $storagePath = $directory.'/'.$itemDocument->path;

      return FileResponse::download($disk, $storagePath, $filename, $itemDocument->mime_type);
  }
  ```

- `App\Filament\Resources\ItemResource\RelationManagers\DocumentsRelationManager` (`app/Filament/Resources/ItemResource/RelationManagers/DocumentsRelationManager.php`) already lists documents (columns: file name, title, MIME type, size, language, order, created at) and uses `AuthorizesRelationMutations`, but its only row action today is `DeleteAction::make()` — no way to upload, download or edit metadata. `tests/Filament/RelationManagerConventionTest.php` already carries the target this design confirms (see [Filament actions](#filament-actions-header-and-row)).
- `config/localstorage.php`'s `documents` section already exists and is what `ItemDocumentController::download()` reads:

  ```php
  'documents' => [
      'disk' => env('DOCUMENTS_DISK', 'public'),
      'directory' => env('DOCUMENTS_DIRECTORY', 'documents'),
  ],
  ```

  **This default is wrong for a security boundary and must change before A4.2 ships real uploads.** `config/filesystems.php` has no `documents` disk of its own, so `DOCUMENTS_DISK=public` resolves to the `public` disk (`storage/app/public`, symlinked to `public/storage`) — i.e. every attached document would sit at a guessable, web-reachable URL with no authorization at all, the exact thing CLAUDE.md's image pipeline forbids ("Never store an original on the public disk"). A4.2 must add a private disk (mirroring `image-originals`) and point `documents.disk` at it. This is a **config change**, not a data-model change, and does not need the approval this document asks for below — but it is load-bearing enough that it is called out explicitly so A4.2 doesn't ship on the current default by accident.
- No `ItemDocumentPolicy` exists. `AuthorizesRelationMutations`'s own docblock (`app/Filament/Concerns/AuthorizesRelationMutations.php`) already lists `ItemDocument` among the related entities with "nothing further to check" beyond host `update` — confirmed by `relatedEntityAllows()` returning `true` when `Gate::getPolicyFor()` finds no policy. Documents stay outside `AttachedImageRegistry` (`app/Support/Images/AttachedImageRegistry.php`) too: that registry is for models implementing `StreamableImageFile`/`HasCopyright`/`BurnsCopyright` and served (burned) at `/pub`; `ItemDocument` does none of that (see [Contrast](#contrast-with-the-image-pipeline)).
- No `notifications` table exists (`database/migrations/` has no `create_notifications_table` migration), and `AdminPanelProvider` doesn't call `->databaseNotifications()`. `User` already `use`s `Illuminate\Notifications\Notifiable` (`app/Models/User.php`), and the app already ships two notification classes on the `mail` channel — `App\Notifications\AdminPasswordResetNotification` and `App\Notifications\Filament\Auth\EmailTwoFactorCodeNotification` — which need no notifications table. This shapes the [notification](#rejection--notification) design below.

## The pipeline

Mirrors the image pipeline's shape end to end — an upload lands privately, an event fires, a listener validates and either promotes or discards it — but collapses the image pipeline's two-stage "uploads → available pool" into one stage, because documents have no reuse pool (see [Contrast](#contrast-with-the-image-pipeline) for why).

1. **Upload.** A Filament `FileUpload` field inside the `DocumentsRelationManager`'s header `Upload` action stores the browser file on the private `local` disk, in a **pending** directory (new config: `localstorage.uploads.documents`, disk `local`, directory `document_uploads/`, mirroring `localstorage.uploads.images`). The `FileUpload` field is configured to generate a random stored filename (Filament's default — never `->preserveFilenames()`), exactly like `ImageUploadController::store()`'s `$file->store(...)` today generates a random name. The `original_name` the browser reports, and the item/language/title/display_order the user filled in on the same modal, are captured at this point — this is data the queued listener needs but cannot re-derive from the file itself.
2. **Stage.** The action's `action()` closure creates a `DocumentUpload` row (see [staging model](#staging-model-yes-documentupload-is-needed) below) carrying: `item_id`, `language_id`, `title`, `display_order`, the pending-disk `path` (filename only, no directory — matching the `ImageUpload`/`AvailableImage` convention), `original_name`, `mime_type` and `size` as reported by the browser, and `uploaded_by` (the current user, for the rejection notification). It then dispatches `DocumentUploadEvent`, and the Livewire request returns immediately — the browser sees the action complete without waiting on validation.
3. **Validate (queued).** `DocumentUploadListener implements ShouldQueue` handles `DocumentUploadEvent` on the queue. Framework-level checks only, per Pascal's decision — no content parsing, no virus scanning, no PDF structure validation:
   - **Size range**: `Illuminate\Validation\Rules\File::default()->min($minKb)->max($maxKb)` (or the equivalent `Validator` call) against `localstorage.uploads.documents.min_size` / `.max_size` (both in KB, mirroring `localstorage.uploads.images.max_size`'s unit).
   - **Extension allow-list**: `File::default()->extensions($allowList)` against `localstorage.uploads.documents.extensions`, initially `pdf` only (comma-separated, same convention as `localstorage.uploads.images.mime`).
   - **MIME allow-list**: checked the same way Laravel's `File` rule already does it — the framework's own MIME guesser (Symfony's) against `localstorage.uploads.documents.mime`, initially `application/pdf`. This is a declared/sniffed MIME type, not a structural validation of the PDF — consistent with "validate only what the framework can."

   If any check fails, or the pending file is missing/unreadable, or an unexpected exception is thrown while processing: the listener deletes the pending file (`Storage::disk($pendingDisk)->delete($path)`), deletes the `DocumentUpload` row, logs via `Log::error` (mirroring `ImageUploadListener`'s existing `Log::error` calls), and sends the [rejection notification](#rejection--notification) — this is one unified "rejected" path, whether the cause was a bad file or an internal error, so nothing exception-specific ever reaches the end user.
4. **Promote.** If every check passes, the listener moves the file from the pending disk/directory to `localstorage.documents` (the existing config key — disk to be repointed at a private disk by A4.2, directory unchanged, `documents/`), creates the `ItemDocument` row (`item_id`, `language_id`, `path` = the moved filename, `original_name`, `mime_type`, `size`, `title`, `display_order` — defaulting via `ItemDocument::getNextDisplayOrderFor(['item_id' => ...])` when not supplied, exactly like `ItemDocumentController::store()` already does), then deletes the `DocumentUpload` row. Recommended (not required): give the new `ItemDocument` the same `id` as the `DocumentUpload` it came from, the way `AvailableImageListener` preserves `ImageUpload`'s id onto `AvailableImage` — it costs nothing and keeps a stable identity thread from upload to attached record if a future story ever wants to poll upload status the way `ImageUploadController::status()` does today for images.
5. **Attach is implicit.** Because there is no reuse pool, "promote" and "attach to the Item" are the same step — there is no separate `attachFromAvailableImage()`-style call. This is the main structural simplification relative to images; see [Contrast](#contrast-with-the-image-pipeline).
6. **Download.** Streams through a Filament-registered route that reuses `ItemDocumentController::download()`'s logic rather than reimplementing it (see [Filament routing](#filament-routing-and-download)).
7. **Delete.** A4.3 makes the row's `Delete` action remove the file from `localstorage.documents` as well as the `ItemDocument` record — the same “delete the row, delete the file” contract `DeletesImageFilesOnDelete` gives every `*Image` model (see [Security](#security) for the cascade caveat and the orphan sweep that catches it).

## Staging model: yes, `DocumentUpload` is needed

**Yes.** A `DocumentUpload` staging model/table is required, for the same reason `ImageUpload` exists: metadata has to survive the hop from a synchronous Livewire request to an asynchronous queue worker, and this codebase's own established pattern for that hop is a real Eloquent row, not a bare job payload. Concretely:

- The item, language, title and display order are entered by the user on the upload form, in the same request that stores the pending file. The queued listener runs later, possibly on a different process, and needs all four to create the `ItemDocument` — a `DocumentUpload` row is the natural, already-precedented place to carry them (`ImageUpload` does the same for `path`/`name`/`extension`/`mime_type`/`size`).
- It gives the rejection notification something to address: `uploaded_by` on the row is how the queued listener knows *who* to notify, since the original HTTP request (and its authenticated-user context) is long gone by the time the job runs.
- It gives orphan-sweep tooling a keep-set to reconcile against (see [Cleanup](#cleanup-of-orphans)), the same role `ImageUpload` plays for `CleanupOriginals`'s grace-period comment ("`ImageUploadListener` writes an original before it creates its `AvailableImage` row: a file younger than this may be one of those").
- It is fully transient, exactly like `ImageUpload`: every row is deleted at the end of processing, whether the outcome is "promoted to `ItemDocument`" or "rejected." Nothing about it is a permanent audit log — `ItemDocument`'s own `created_at` is that record.

An alternative that avoids a new table — serializing the metadata directly onto `DocumentUploadEvent`'s constructor and letting Laravel's queue serialize the plain event object — was considered and rejected: it would lose the single durable, ID-addressable, queryable row that this codebase already uses for exactly this purpose (`ImageUpload::find($id)` is real, inspectable state; a job's serialized payload is not something anyone would `find()` in Tinker or log against), and it would leave `documents:cleanup-pending` (below) with no way to notice a stuck upload.

### Proposed migration — needs Pascal's approval

{: .warning }
> No migration file is included in this PR. This schema is proposed here for review only; Pascal posts it as a comment on [#1905](https://github.com/museumwithnofrontiers/inventory-app/issues/1905) for explicit approval before A4.2 starts, per the epic's "no data-model change anywhere except what the documents design story (A4.1) explicitly asks Pascal to approve."

```php
Schema::create('document_uploads', function (Blueprint $table) {
    $table->uuid('id')->primary();
    $table->uuid('item_id');
    $table->string('language_id', 3)->nullable();
    $table->string('path');
    $table->string('original_name');
    $table->string('mime_type');
    $table->bigInteger('size');
    $table->string('title')->nullable();
    $table->integer('display_order')->nullable();
    $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
    $table->timestamps();

    $table->foreign('item_id')->references('id')->on('items')->onDelete('cascade');
    $table->foreign('language_id')->references('id')->on('languages')->onDelete('set null');
    $table->index('item_id');
});
```

Column-by-column reasoning:

| Column | Type | Why |
|---|---|---|
| `id` | `uuid`, primary | UUID PK per CLAUDE.md's model rule (everything except `Language`, `Country`, `User`); matches `ItemDocument.id` and `ImageUpload.id`. |
| `item_id` | `uuid`, FK → `items.id`, cascade delete | Matches `ItemDocument.item_id` exactly. If the Item is deleted mid-upload, the pending row (and, via the sweep, its file) should go with it rather than orphan silently. |
| `language_id` | `string(3)`, nullable, FK → `languages.id`, set-null | Matches `ItemDocument.language_id` exactly — this is metadata the user picks on the upload form and that must carry straight through. |
| `path` | `string` | Filename only (no directory) on the pending disk, matching `ImageUpload.path` / `AvailableImage.path` convention. |
| `original_name` | `string` | The browser-reported filename, matching `ItemDocument.original_name`'s name (not `ImageUpload.name`) since this column maps 1:1 onto the `ItemDocument` row the listener creates. |
| `mime_type` | `string` | As reported/guessed at upload time; the listener re-checks it against the allow-list rather than trusting it for the accept/reject decision, but it's useful in logs. |
| `size` | `bigInteger` | Bytes, matching `ItemDocument.size`. |
| `title` | `string`, nullable | Matches `ItemDocument.title`; optional, entered on the upload form. |
| `display_order` | `integer`, nullable | Unlike `ItemDocument.display_order` (`default(0)`), this is nullable so the listener can tell "not set" from "explicitly 0" and fall back to `ItemDocument::getNextDisplayOrderFor()`, exactly like `ItemDocumentController::store()` already does for the API. |
| `uploaded_by` | `unsignedBigInteger`, nullable, FK → `users.id`, set-null | `User` has an integer PK (CLAUDE.md's stated exception). Nullable/set-null so a deleted user doesn't block cleanup of their pending upload; in that edge case the rejection notification simply can't be sent, which is an acceptable, rare gap. |
| `created_at`/`updated_at` | timestamps | `created_at` is the grace-period reference for `documents:cleanup-pending` (below), the same role `ImageUpload.created_at`/`AvailableImage`'s file mtime play for `CleanupOriginals`. |

No `extra` or `backward_compatibility` columns: those are `ItemDocument`-only concerns (importer/API metadata) that never apply to a row that lives for, at most, one queue cycle.

## Contrast with the image pipeline

CLAUDE.md's canonical pipeline: `ImageUpload` → `ImageUploadEvent` → `ImageUploadListener` → `AvailableImage` → `AvailableImageEvent` → `AvailableImageListener`, three disks (uploads/available/pictures), `attachFromAvailableImage()`/`detachToAvailableImage()`, `DeletesImageFilesOnDelete`, burned serving at `/pub`.

| Image pipeline (CLAUDE.md) | Document pipeline (this design) | Why the difference |
|---|---|---|
| `ImageUpload` (transient staging model) | `DocumentUpload` (transient staging model) | **Same shape.** Both exist for the same reason: carry upload metadata across the request/queue boundary. |
| `ImageUploadListener` — **not queued** in the current codebase (no `ShouldQueue`; relies on Laravel's default event auto-discovery, runs synchronously in the same request) | `DocumentUploadListener` — **`implements ShouldQueue`**, genuinely asynchronous | Pascal's locked decision is explicit: "queued pre-processing." Unlike images (which resize inline, fast enough to do synchronously today), the point of queuing documents is to keep the Filament `Upload` action from blocking on validation at all, and to establish the async pattern documents are meant to have from day one. This also means documents face a genuine "job never ran yet" window that images don't currently have — see [Cleanup](#cleanup-of-orphans). |
| `ImageUploadListener` validates by **actually decoding the file** with Intervention Image (`ImageManager::read()`) — real content validation, plus it resizes | `DocumentUploadListener` validates **size range + extension + declared/guessed MIME only**, via Laravel's own `File` validation rule | Pascal's decision: "validate only what the framework can (size range, extension allowlist e.g. pdf)." There's no content-level check (no PDF structure parsing, no malware scan) and no transform step (no equivalent of resizing) — those are explicitly out of scope for this pipeline. |
| Two-stage pool: `ImageUpload` → **`AvailableImage`** (a reusable library, independently browsable via `AvailableImageResource`, attachable to *many* different entities via `attachFromAvailableImage()`) | **No pool.** `DocumentUpload` → `ItemDocument` directly; validation and attachment happen in the same listener call | Images need a shared, reusable "available" pool because the same photo can be attached to an Item, a Collection, a Partner, etc., and because uploads happen from several different forms across the app. Documents attach to exactly one Item each (`ItemDocument.item_id`, not a pivot), uploaded from exactly one place (`DocumentsRelationManager`'s `Upload` action) — there is nothing to pool or reuse, so the "available" stage and its own event/listener pair simply don't exist for documents. |
| `attachFromAvailableImage()` / `detachToAvailableImage()` on every `*Image` model (`DetachableImage`) — a row swap that preserves id/path/copyright, original never moves | **No attach/detach step at all.** `ItemDocument` is created directly by the listener; there is nothing to detach it *to*, because there is no available pool to return it to | Detach exists for images because the original is meant to survive disconnection from one entity and remain pickable for another. A document has exactly one owner for its whole life; "detach" has no meaning here. Removing a document is just `Delete` (see A4.3). |
| Three disks: **uploads** (private `local`), **available/originals** (private `image-originals`), **pictures** (**public**, burned-rendition cache only) | Two disks: **uploads** (private `local`, new `localstorage.uploads.documents`), **documents** (private, existing `localstorage.documents` key — disk needs repointing away from `public`) | The `pictures` disk exists purely to cache **burned** renditions so they can be served publicly and cheaply at `/pub`. Documents are never burned and never served publicly (see next row), so there is no third disk and no cache to manage. |
| Copyright is burned into the image on demand (`ImageBurner`) and cached; served publicly and unauthenticated at `/pub/{filename}`, baked into npm data packages | **No burning, no public serving.** Documents are served only through an authenticated Filament route (and the existing authenticated API route) that stream the private original | The entire burning apparatus exists because pictures are public-facing museum content that must always carry copyright and be cheap to serve at scale (npm data packages bake in stable `/pub` URLs). Documents (PDFs attached to an Item, e.g. condition reports, provenance paperwork) have no such public-consumption requirement in this epic — nothing asks for a `/pub`-style document URL. Inventing burning/public-caching machinery for a feature nobody asked for would be exactly the kind of shortcut CLAUDE.md forbids in the other direction (adding an unneeded public surface to a private artifact). |
| `ItemImage` (and siblings) implement `StreamableImageFile` + `HasCopyright` (+ `BurnsCopyright`), use `DeletesImageFilesOnDelete`, and are listed in `AttachedImageRegistry` | `ItemDocument` implements **none** of these and is **not** in `AttachedImageRegistry` | That whole contract exists to keep `/pub` serving, copyright resolution and the originals-cleanup sweep working generically across every image model. Since documents are never burned or served at `/pub`, the contract doesn't apply — `AttachedImageRegistry::validate()` would have nothing meaningful to check on a model with no `StreamableImageFile`/`HasCopyright` shape. A4.3 does still need a `DeletesImageFilesOnDelete`-equivalent hook on `ItemDocument` (deleting the row must delete its file too), it's just a standalone trait, not a registry member — see [Security](#security). |
| Attached image download/view served via `InlineImageResponse`/`DownloadImageResponse` (Filament) and `BurnedImageResponse` (API) | Attached document download served by `FileResponse::download()` (already generic, already used by both the API controller today and the Filament controller this design adds) | Documents only ever need one disposition (`attachment` — there's no "view inline burned" concept), so the existing generic `FileResponse` is enough; no document-specific response class is needed. |

## Filament actions: header and row

`tests/Filament/RelationManagerConventionTest.php` already carries this design's target, provisionally, in `assertDocumentsConvention()`:

```php
$header = $this->flattenActions($table->getHeaderActions());
$this->assertSame(['upload'], $this->namesOf($header), "{$class}: header actions must be exactly [upload] (#1906).");

$row = $this->flattenActions($table->getActions());
$this->assertSame(['download', 'edit', 'delete'], $this->namesOf($row), "{$class}: row actions must be exactly [download, edit, delete] (#1907).");
```

**This design confirms those names as-is** — `upload` / `download` / `edit` / `delete`:

- `Upload` (header) is deliberately not `Create` (the has-many/pivot conventions' header verb): `Create` in this codebase always means "navigate to a Resource's Create page" (`AuthorizesRelationMutations`'s own docblock) or, for the sibling `MediaRelationManager`, "open an inline metadata-only modal." Uploading a file is neither — `Upload` names what actually happens and reads correctly as a header verb.
- `Download` (row) is the one row action documents need that no other relation-manager convention has (has-many/pivot rows never stream a file). Naming it for what it does, rather than overloading `View`, avoids implying there's an inline preview (there isn't — PDFs download, they don't render inside Filament).
- `Edit` (row) opens a metadata-only modal (`title`, `language`, `display_order`, `extra` per #1907) — never re-uploads the file, matching the pivot convention's "Edit is metadata-only" rule even though documents aren't a pivot relation.
- `Delete` (row) is unchanged from what's there today.

No bulk actions are specified for documents (parity with `MediaRelationManager`'s pending target, which also has none) — items typically carry a handful of documents, not thousands, so a bulk-delete's blast radius doesn't buy enough to justify the extra confirmation surface.

**Authorization**, per the epic's rule and #1906/#1907's own "Conventions" sections: every one of `upload`/`download`/`edit`/`delete` requires `update` on the Item via `ItemPolicy`, exactly like every other mutating relation-manager action, using `AuthorizesRelationMutations::hostRecordCanBeUpdated()`. `DocumentsRelationManager` already `use`s that trait. Two things worth being explicit about because they're easy to get wrong:

- `Download` is a **mutating-tier** action for authorization purposes even though it doesn't write anything, because #1907 says so explicitly ("Edit/Delete/Download require update on the Item via ItemPolicy") — a `view data`-only user must not be able to pull a document off an Item they can't edit. This is stricter than the built-in Filament actions `AuthorizesRelationMutations` already covers (`canCreate`/`canEdit`/`canDelete`/...), so `Download` needs its own explicit `->visible(fn () => $this->hostRecordCanBeUpdated())` (or equivalent) the way the trait's own docblock already prescribes for any custom `Action::make(...)`.
- `Upload` is a **custom header action** (Filament has no built-in "upload" action), so it too needs an explicit `->visible(fn () => $this->hostRecordCanBeUpdated())`, again per the trait's documented pattern for custom actions.

## Rejection & notification

The queued listener is, by construction, running after the HTTP request that started the upload has already finished — a flash/session notification cannot reach the user, and Filament's own database-notification bell (`Notification::make()->sendToDatabase()`) needs a `notifications` table that doesn't exist in this app today (`php artisan notifications:table` was never run; `AdminPanelProvider` doesn't call `->databaseNotifications()`). Adding that table would be a second schema change on top of `document_uploads`, which conflicts with the issue's own framing of this design's migration as "the milestone's only data-model change."

**Recommendation: a `mail`-channel Laravel notification**, sent to `$documentUpload->uploaded_by`'s user record — no schema change, and it's already this codebase's established pattern for user-facing notifications (`App\Notifications\AdminPasswordResetNotification`, `App\Notifications\Filament\Auth\EmailTwoFactorCodeNotification`; `User` already `use`s `Notifiable`). A new `App\Notifications\ItemDocumentUploadRejected` notification, carrying the original filename, the Item it was destined for, and a short, generic reason ("file type not allowed", "file too large/small") — never an internal exception message. Sent via `Notification::send($user, new ItemDocumentUploadRejected(...))` from inside the listener's rejection branch, for both "invalid file" and "unexpected error" outcomes (see [step 3](#the-pipeline)) — the user only ever needs to know "your upload didn't go through," not why the server-side code failed.

If Pascal would rather have in-panel (bell-icon) notifications instead of email, that only requires adding the standard Laravel `notifications` table (`php artisan notifications:table`, a stock migration with no app-specific columns) and turning on `->databaseNotifications()` in `AdminPanelProvider` — technically simple, but it is an additional schema change this document does not propose, to keep this design's approval ask to the single `document_uploads` table above. If Pascal approves both, A4.2 can add the stock notifications table alongside `document_uploads` in the same approved comment.

## Filament routing and download

Mirrors the existing pattern in `AdminPanelProvider` (`app/Providers/Filament/AdminPanelProvider.php`, `authenticatedRoutes()`), which already registers `view`/`download` routes per image model, each backed by a small controller under `App\Http\Controllers\Filament\*` (e.g. `ItemImageController::download()` returning `new DownloadImageResponse($itemImage)` after checking `$itemImage->item_id === $item->id`):

```php
Route::get('/items/{item}/documents/{itemDocument}/download', [FilamentItemDocumentController::class, 'download'])
    ->name('item-document.download');
```

`App\Http\Controllers\Filament\ItemDocumentController::download(Item $item, ItemDocument $itemDocument)`:

1. `abort(404)` if `$itemDocument->item_id !== $item->id` (referential-integrity check, same as the image controllers).
2. Authorize `update` on `$item` via `ItemPolicy` (`$this->authorize('update', $item)` or `abort_unless(...)`) — per #1907's rule. This is **stricter** than the existing Filament image controllers, which today check only the referential-integrity guard above and rely on the panel's login requirement, not a per-record policy. Documents' rule is explicit in the epic text, so this design follows it even though it's a slightly tighter bar than the current image precedent.
3. Delegate to `App\Http\Controllers\ItemDocumentController::download($itemDocument)` rather than reimplementing the disk/path/`FileResponse` logic — literally `return (new \App\Http\Controllers\ItemDocumentController)->download($itemDocument);` (or extend it and call `parent::download()`). This satisfies #1907's acceptance line ("reuses `ItemDocumentController::download`'s logic rather than reimplementing it") directly: the Filament controller reuses the *same method*, not a copy of its body.

This is additional to, not a replacement for, the existing authenticated API route `GET /api/item-document/{itemDocument}/download` (`routes/api.php`) — that route stays as-is for API consumers; the new Filament route exists because Filament runs on the session guard, not Sanctum, and needs its own URL under the panel's own auth middleware stack.

## Security

- **Never web-reachable.** Both the pending disk (`localstorage.uploads.documents`, on `local`) and the final disk (`localstorage.documents`, once repointed off `public` — see [Where things stand today](#where-things-stand-today)) are private: no `url` key, no `storage:link` exposure, nothing under `storage/app/public`. The only way to read a document's bytes is through the download routes above or the API controller, both of which require authentication (Filament: panel session; API: whatever guard already protects `routes/api.php`'s `item-document.download`).
- **Download authorization**, restated from [Filament routing](#filament-routing-and-download): `update` on the owning Item via `ItemPolicy`, checked explicitly in the Filament controller — not delegated to `AuthorizesRelationMutations` (that trait governs the relation manager's own Livewire actions, not a plain route).
- **Filename handling.** The stored `path` is always a server-generated name (random, via Filament's default `FileUpload` behavior for the pending file, then whatever naming the listener uses when it writes to the final disk) — never derived from the browser-supplied `original_name`. This matches `ImageUpload`/`AvailableImage` today (`$file->store(...)` without a custom name argument) and means the user-controlled filename is only ever used for the `Content-Disposition` header (`FileResponse::download()`'s `$filename` argument), which Laravel's `response()->download()` (Symfony under the hood) already sanitizes — it is never used to build a storage path, so there is no path-traversal surface.
- **Queue failure.** The listener wraps its work in a single try/catch (mirroring `ImageUploadListener`'s own broad `catch (\Exception $e)`): any failure — validation or unexpected — deletes the pending file and the `DocumentUpload` row and sends the same rejection notification (see [Rejection & notification](#rejection--notification)). Two edge cases worth naming rather than silently accepting:
  - If the `DocumentUpload` row is deleted (e.g. by the cleanup sweep) before the queued job runs, `SerializesModels` will find nothing to re-hydrate and Laravel discards the job silently — no notification fires. The [cleanup sweep](#cleanup-of-orphans) is the backstop for this case, not the notification.
  - A worker crash or infrastructure failure that never lets the listener's catch block run at all leaves the pending file and row in place; they age past the grace period and the sweep below reports/removes them.
- **Deletion and cascades.** A4.3's `Delete` row action must remove both the `ItemDocument` record and its file on `localstorage.documents` — the same contract `DeletesImageFilesOnDelete` gives every `*Image` model, but as its own small trait (`ItemDocument` has no `StreamableImageFile` shape to hang the existing trait off, per [Contrast](#contrast-with-the-image-pipeline)). Exactly like that trait, a **database cascade** (the Item itself being deleted, which cascades `item_documents` per its migration's `onDelete('cascade')`) skips Eloquent's `deleting` event entirely — the file is left behind on disk with nothing pointing to it. This is the same known gap `images:cleanup-originals` exists to sweep for images, and documents need the equivalent.

## Cleanup of orphans

Two sweeps, mirroring `images:cleanup-originals`/`images:cleanup-pictures` (`app/Console/Commands/CleanupOriginals.php`, `CleanupPictures.php`) and reusing the same `CleansOrphanedFiles` trait (`app/Console/Commands/Concerns/CleansOrphanedFiles.php`):

- **`documents:cleanup-orphans`** — direct analogue of `images:cleanup-originals`. Sweeps `localstorage.documents`'s disk/directory for files with no `ItemDocument.path` pointing at them (built from a keep-set of every `ItemDocument::query()->pluck('path')`, the same shape `CleanupOriginals::buildKeepSet()` uses for `AttachedImageRegistry` + `AvailableImage`). This is what catches the cascade-delete gap above.
- **`documents:cleanup-pending`** — a genuinely new need, because documents are actually queued end-to-end and images (whose listener runs synchronously today) aren't: sweeps `DocumentUpload` rows older than a grace period (e.g. 1 hour, matching `CleanupOriginals::GRACE_PERIOD`) that still exist — meaning their queued job never completed, since success always deletes the row. Reports them (and, with `--delete`, removes the row and its pending file) the same dry-run-by-default, `--delete`/`--force`/`--older-than`/`--limit`/`--json` way the existing commands do.

Both should follow the existing commands' options and output format exactly (dry-run by default, `--json` for tooling) rather than inventing a new CLI convention.

## Config keys

New (`config/localstorage.php`, `uploads` section, sibling to the existing `uploads.images`):

| Key | Default | Meaning |
|---|---|---|
| `localstorage.uploads.documents.disk` | `local` (via `env('UPLOAD_DOCUMENTS_DISK', 'local')`) | Private disk for pending uploads. |
| `localstorage.uploads.documents.directory` | `document_uploads` (via `env('UPLOAD_DOCUMENTS_DIRECTORY', 'document_uploads')`) | Pending-upload directory on that disk. |
| `localstorage.uploads.documents.min_size` | `1` KB (via `env('UPLOAD_DOCUMENTS_MIN_SIZE', 1)`) | Rejects empty/near-empty files. |
| `localstorage.uploads.documents.max_size` | `20480` KB / 20 MB (via `env('UPLOAD_DOCUMENTS_MAX_SIZE', 20480)`), matching `uploads.images.max_size`'s default | Upper size bound. |
| `localstorage.uploads.documents.extensions` | `pdf` (via `env('UPLOAD_DOCUMENTS_EXTENSIONS', 'pdf')`) | Comma-separated extension allow-list. |
| `localstorage.uploads.documents.mime` | `application/pdf` (via `env('UPLOAD_DOCUMENTS_MIME_TYPES', 'application/pdf')`) | Comma-separated MIME allow-list, same shape as `uploads.images.mime`. |

Existing, needing a **default change only** (no key rename, so `ItemDocumentController::download()` and `ItemDocumentResource` need no changes):

| Key | Current default | Needed default |
|---|---|---|
| `localstorage.documents.disk` | `public` (`env('DOCUMENTS_DISK', 'public')`) | A new private disk (e.g. `document-originals`, mirroring `image-originals`'s definition in `config/filesystems.php`) |
| `localstorage.documents.directory` | `documents` | Unchanged |

All of the above are config changes for **A4.2** to make, not this PR.

## Out of scope (deliberately)

- Content-level validation (real PDF parsing, malware/virus scanning) — "validate only what the framework can" is Pascal's explicit boundary for this epic.
- Any reuse/library concept for documents (no `AvailableDocument`, no cross-Item document picker) — nothing in the epic or its stories asks for one, and `ItemDocument.item_id` is a plain FK, not a pivot.
- Public/`/pub`-style serving of documents, and therefore no copyright burning, no `ImageBurner`/`PublicRenditions` equivalent, no `AttachedImageRegistry` membership.
- In-panel (database) notifications — recommended as a follow-up if Pascal prefers them over email, contingent on a separate, explicitly-approved `notifications` table (see [Rejection & notification](#rejection--notification)).
- Editing or replacing the file behind an existing `ItemDocument` — A4.3's `Edit` modal is metadata-only (`title`, `language`, `display_order`, `extra`); replacing the file itself would mean uploading a new document and deleting the old one.
